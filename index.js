const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const { PDFDocument, rgb } = require('pdf-lib');
require('dotenv').config();

const app = express();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
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
    storage: storage,
    limits: { fileSize: 500 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('File type not supported'));
        }
    }
}).single('photo');

app.post('/send-otp', (req, res) => {
    const { email, name } = req.body;
    const otp = crypto.randomInt(1000, 9999).toString();
    otpStore[email] = otp;

    setTimeout(() => {
        delete otpStore[email];
    }, 300000);

    fs.readFile(path.join(__dirname, 'otp-email.html'), 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading HTML file:', err);
            return res.status(500).send('Error generating email');
        }

        const htmlContent = data.replace('{Name}', name).replace('{OTP}', otp);

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Your OTP Code',
            html: htmlContent,
            attachments: [{
                filename: 'logo.png',
                path: path.join(__dirname, 'public', 'econlogo.png'),
                cid: 'logo'
            }]
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending OTP:', error);
                return res.status(500).send('Error sending OTP');
            }
            console.log('OTP sent:', info.response);
            res.send('OTP sent');
        });
    });
});

app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] === otp) {
        delete otpStore[email];
        res.send('OTP verified');
    } else {
        res.status(400).send('Invalid or expired OTP');
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

        const photo = req.file.buffer;

        const symbolNumber = await assignSymbolNumber(nearestExamCenter);

        const sql = `INSERT INTO registrations (
            name, contactNumber, email, gender, class, district, province,
            address, dateOfBirth, schoolName, schoolAddress, nearestExamCenter,
            parentsName, parentsContactNumber, principalName, principalContactNumber,
            source, photo, symbolNumber
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await db.execute(sql, [
            name, contactNumber, email, gender, studentClass, district, province,
            address, date, schoolName, schoolAddress, nearestExamCenter, parentsName,
            parentsContactNumber, principalName, principalContactNumber, source, photo,
            symbolNumber
        ]);

        const admitCardBuffer = await generateAdmitCard({
            symbolNumber, name, contactNumber, date, schoolName, nearestExamCenter
        });

        fs.readFile(path.join(__dirname, 'admitcard.html'), 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading HTML file:', err);
                return res.status(500).send('Error generating email');
            }

            const emailHtml = data.replace('{Name}', name);

            const mailOptions = {
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
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending registration email:', error);
                    return res.status(500).send('Error sending registration email');
                }
                console.log('Registration email sent:', info.response);
                res.send('Registration successful');
            });
        });
    } catch (err) {
        console.error('Error inserting registration:', err);
        res.status(500).send('Error registering');
    }
});

async function assignSymbolNumber(nearestExamCenter) {
    try {
        const [rows] = await db.query('SELECT last_assigned_number FROM exam_center_numbers WHERE center_name = ? FOR UPDATE', [nearestExamCenter]);
        let lastAssignedNumber = rows[0].last_assigned_number;

        lastAssignedNumber++;

        await db.query('UPDATE exam_center_numbers SET last_assigned_number = ? WHERE center_name = ?', [lastAssignedNumber, nearestExamCenter]);

        const symbolNumber = `25NEO${String(lastAssignedNumber).padStart(5, '0')}`;

        return symbolNumber;
    } catch (error) {
        console.error('Error assigning symbol number:', error);
        throw error;
    }
}

async function generateAdmitCard(details) {
    const { symbolNumber, name, contactNumber, date, schoolName, nearestExamCenter } = details;

    const existingPdfBytes = fs.readFileSync(path.join(__dirname, 'neo2025_admitcard.pdf'));

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    firstPage.drawText(symbolNumber, { x: 150, y: height - 200, size: 12, color: rgb(0, 0, 0) });
    firstPage.drawText(name, { x: 150, y: height - 220, size: 12, color: rgb(0, 0, 0) });
    firstPage.drawText(contactNumber, { x: 150, y: height - 240, size: 12, color: rgb(0, 0, 0) });
    firstPage.drawText(date, { x: 150, y: height - 260, size: 12, color: rgb(0, 0, 0) });
    firstPage.drawText(schoolName, { x: 150, y: height - 280, size: 12, color: rgb(0, 0, 0) });
    firstPage.drawText(nearestExamCenter, { x: 150, y: height - 300, size: 12, color: rgb(0, 0, 0) });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

const server = app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
