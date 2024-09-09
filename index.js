const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const mysql = require('mysql2/promise');
const { PDFDocument, rgb } = require('pdf-lib');
const sharp = require('sharp');
require('dotenv').config();

const app = express();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000 // 60 seconds
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let otpStore = {};

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        mimetype && extname ? cb(null, true) : cb(new Error('File type not supported'));
    }
}).single('photo');

const logActivity = async (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    await fs.appendFile(path.join(__dirname, 'activity.log'), logMessage);
};

app.post('/send-otp', async (req, res) => {
    const { email, name } = req.body;
    const otp = crypto.randomInt(1000, 9999).toString();
    const timestamp = Date.now();

    if (otpStore[email] && (timestamp - otpStore[email].timestamp < 60000)) {
        return res.status(429).send('Please wait a minute before requesting a new OTP.');
    }

    otpStore[email] = { otp, timestamp };
    setTimeout(() => delete otpStore[email], 300000);

    try {
        const data = await fs.readFile(path.join(__dirname, 'otp-email.html'), 'utf8');
        const htmlContent = data.replace('{Name}', name).replace('{OTP}', otp);

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Your OTP Code',
            html: htmlContent,
            attachments: [{
                filename: 'logo.png',
                path: path.join(__dirname, 'public', 'econlogo.png'),
                cid: 'logo'
            }]
        });
        await logActivity(`OTP sent to ${name} at ${email}`);
        console.log('OTP sent successfully to:', email);
        return res.status(200).send('OTP sent');
    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).send('Error sending OTP');
    }
});

app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] && otpStore[email].otp === otp) {
        delete otpStore[email];
        await logActivity(`OTP verified for ${email}`);
        console.log('OTP verified successfully for:', email);
        return res.status(200).send('OTP verified');
    } else {
        await logActivity(`Invalid or expired OTP for ${email}`);
        console.log('Invalid or expired OTP for:', email);
        return res.status(400).send('Invalid or expired OTP');
    }
});

app.post('/register', upload, async (req, res) => {
    try {
        const {
            name, contactNumber, email, gender, class: studentClass,
            district, province, address, date, schoolName, schoolAddress,
            nearestExamCenter, parentsName, parentsContactNumber,
            principalName, principalContactNumber, source
        } = req.body;
        const [rows] = await db.query('SELECT * FROM registrations WHERE name = ? AND email = ?', [name, email]);
        if (rows.length > 0) {
            await logActivity(`Duplicate registration attempt for ${name} with email ${email}`);
            return res.status(400).send('Duplicate Registrations Not Allowed');
        }

        const symbolNumber = await assignSymbolNumber(nearestExamCenter);
        await logActivity(`Symbol number ${symbolNumber} fetched for ${name} with email ${email}`);

        const photo = req.file.buffer;
        const photoMimeType = req.file.mimetype;

        const resizedPhoto = await sharp(photo)
            .resize({ width: 500, height: 500 })
            .toBuffer();

        const photoDir = path.join(__dirname, 'neo2025_regional');
        await fs.mkdir(photoDir, { recursive: true });

        const photoPath = path.join(photoDir, `${symbolNumber}.jpg`);
        await fs.writeFile(photoPath, resizedPhoto);

        const photoUrl = `/neo2025_regional/${symbolNumber}.jpg`;

        const sql = `INSERT INTO registrations (
            name, contactNumber, email, gender, class, district, province,
            address, dateOfBirth, schoolName, schoolAddress, nearestExamCenter,
            parentsName, parentsContactNumber, principalName, principalContactNumber,
            source, photo, symbolNumber
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await db.execute(sql, [
            name, contactNumber, email, gender, studentClass, district, province,
            address, date, schoolName, schoolAddress, nearestExamCenter, parentsName,
            parentsContactNumber, principalName, principalContactNumber, source, photoUrl,
            symbolNumber
        ]);

        const admitCardBuffer = await generateAdmitCard({
            symbolNumber, name, contactNumber, date, schoolName, nearestExamCenter
        }, resizedPhoto, photoMimeType);

        const data = await fs.readFile(path.join(__dirname, 'admitcard.html'), 'utf8');
        const emailHtml = data.replace('{Name}', name);

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: 'NEO 2025 Registration Successful - Admit Card Attached',
            html: emailHtml,
            attachments: [
                {
                    filename: 'admit_card.pdf',
                    content: admitCardBuffer,
                    contentType: 'application/pdf'
                },
                {
                    filename: 'logo.png',
                    path: path.join(__dirname, 'public', 'econlogo.png'),
                    cid: 'logo'
                }
            ]
        });
        await logActivity(`Admit card generated and mailed for ${name} at ${email}`);
        console.log('Registration successful for:', email);
        return res.status(200).send('Registration successful');
    } catch (err) {
        console.error('Error registering:', err);
        return res.status(500).send('Error registering');
    }
});

app.post('/send-status-otp', async (req, res) => {
    const { email, name } = req.body;
    const otp = crypto.randomInt(1000, 9999).toString();
    const timestamp = Date.now();

    if (otpStore[email] && (timestamp - otpStore[email].timestamp < 60000)) {
        return res.status(429).send('Please wait a minute before requesting a new OTP.');
    }

    otpStore[email] = { otp, timestamp };
    setTimeout(() => delete otpStore[email], 300000);

    try {
        const data = await fs.readFile(path.join(__dirname, 'otp-email.html'), 'utf8');
        const htmlContent = data.replace('{Name}', name).replace('{OTP}', otp);

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Your OTP Code',
            html: htmlContent,
            attachments: [{
                filename: 'logo.png',
                path: path.join(__dirname, 'public', 'econlogo.png'),
                cid: 'logo'
            }]
        });
        await logActivity(`Status OTP sent to ${name} at ${email}`);
        console.log('Status OTP sent successfully to:', email);
        return res.status(200).send('OTP sent');
    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).send('Error sending OTP');
    }
});

app.post('/verify-status-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] && otpStore[email].otp === otp) {
        delete otpStore[email];
        await logActivity(`Status OTP verified for ${email}`);
        console.log('Status OTP verified successfully for:', email);

        const [rows] = await db.query('SELECT * FROM registrations WHERE email = ?', [email]);
        if (rows.length > 0) {
            const registration = rows[0];
            const { photo, ...registrationDetails } = registration;
            await logActivity(`Registration data fetched for ${email}`);
            return res.status(200).json({
                status: 'Found',
                message: "Data Found Successfully! Your Registration Details are:",
                details: registrationDetails
            });
        } else {
            await logActivity(`No registration data found for ${email}`);
            return res.status(404).json({
                status: 'Not Found',
                message: "Data Not Found! If you have registered, contact our support team."
            });
        }
    } else {
        await logActivity(`Invalid or expired status OTP for ${email}`);
        console.log('Invalid or expired status OTP for:', email);
        return res.status(400).send('Invalid or expired OTP');
    }
});

async function assignSymbolNumber(nearestExamCenter) {
    try {
        const [rows] = await db.query('SELECT last_assigned_number FROM exam_center_numbers WHERE center_name = ?', [nearestExamCenter]);
        let lastAssignedNumber = rows[0].last_assigned_number;
        lastAssignedNumber++;
        await db.query('UPDATE exam_center_numbers SET last_assigned_number = ? WHERE center_name = ?', [lastAssignedNumber, nearestExamCenter]);
        return `25NEO${String(lastAssignedNumber).padStart(5, '0')}`;
    } catch (error) {
        console.error('Error assigning symbol number:', error);
        throw error;
    }
}

async function generateAdmitCard(details, imageBuffer, imageMimeType) {
    const { symbolNumber, name, contactNumber, date, schoolName, nearestExamCenter } = details;
    const existingPdfBytes = await fs.readFile(path.join(__dirname, 'neo2025_admitcard.pdf'));

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const [firstPage] = pdfDoc.getPages();
    const { height } = firstPage.getSize();

    const positions = {
        symbolNumber: { x: 64 / 25.4 * 72, y: height - (84 / 25.4 * 72) },
        name: { x: 64 / 25.4 * 72, y: height - (94 / 25.4 * 72) },
        contactNumber: { x: 64 / 25.4 * 72, y: height - (104 / 25.4 * 72) },
        date: { x: 64 / 25.4 * 72, y: height - (114 / 25.4 * 72) },
        schoolName: { x: 64 / 25.4 * 72, y: height - (124 / 25.4 * 72) },
        nearestExamCenter: { x: 64 / 25.4 * 72, y: height - (134 / 25.4 * 72) },
    };

    Object.entries(positions).forEach(([key, pos]) => {
        firstPage.drawText(details[key], { x: pos.x, y: pos.y, size: 12, color: rgb(0, 0, 0) });
    });

    const image = imageMimeType.includes('jpeg') ? await pdfDoc.embedJpg(imageBuffer) : await pdfDoc.embedPng(imageBuffer);
    const imageDims = image.scale(0.25);
    const moveUpPoints = 6 / 25.4 * 72;

    firstPage.drawImage(image, {
        x: 141 / 25.4 * 72,
        y: height - (84 / 25.4 * 72 + imageDims.height) + moveUpPoints,
        width: Math.min(imageDims.width, 182 / 25.4 * 72),
        height: Math.min(imageDims.height, 122 / 25.4 * 72),
    });

    return await pdfDoc.save();
}

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
