document.addEventListener("DOMContentLoaded", () => {
    const sendOtpButton = document.getElementById("sendOtpButton");
    const verifyOtpButton = document.getElementById("verifyOtpButton");
    const registerButton = document.getElementById("registerButton");
    const emailInput = document.getElementById("email");
    const nameInput = document.getElementById("name");
    const otpInput = document.getElementById("otp");
    const otpSection = document.querySelector(".otp-section");
    const photoInput = document.getElementById("photo");
    const registrationForm = document.getElementById("registrationForm");
    const step1 = document.getElementById("step1");
    const step2 = document.getElementById("step2");
    const resendOtpTimer = document.getElementById("resendOtpTimer");
    const timerElement = document.getElementById("timer");
    const thankYouMessage = document.getElementById("thankYouMessage");
    const loadingElement = document.getElementById("loading");
    const messageContainer = document.querySelector(".message-container");

    const newRegistrationButton = document.getElementById('newRegistrationButton');
    const checkStatusButton = document.getElementById('checkStatusButton');
    const mainOptions = document.querySelector('.main-options');
    const statusForm = document.getElementById('statusForm');
    const sendStatusOtpButton = document.getElementById('sendStatusOtpButton');
    const verifyStatusOtpButton = document.getElementById('verifyStatusOtpButton');
    const statusOtpInput = document.getElementById('statusOtp');
    const statusMessage = document.getElementById('statusMessage');
    const statusMessageText = document.getElementById('statusMessageText');
    const statusDetailsContainer = document.getElementById('statusDetailsContainer');
    const resendOtpTimerStatus = document.getElementById("resendOtpTimerStatus");
    const timerElementStatus = document.getElementById("timerStatus");
    const otpSectionStatus = document.querySelector(".otp-section-status");

    let emailVerified = false;
    let photoValid = false;
    let timer;
    let timerStatus;

    const displayMessage = (message, type, container) => {
        if (container) {
            container.innerHTML = `<p style="color: ${type === 'error' ? 'red' : 'green'}; font-weight: bold;">${message}</p>`;
        } else {
            console.error("Message container not found");
        }
    };

    const startTimer = (duration, timerElement, resendOtpTimerElement, sendOtpButtonElement) => {
        let timeRemaining = duration;
        resendOtpTimerElement.style.display = "block";
        timerElement.textContent = timeRemaining;
        timer = setInterval(() => {
            timeRemaining--;
            timerElement.textContent = timeRemaining;
            if (timeRemaining <= 0) {
                clearInterval(timer);
                resendOtpTimerElement.style.display = "none";
                sendOtpButtonElement.disabled = false;
            }
        }, 1000);
    };

    const showLoading = (show) => {
        if (loadingElement) {
            loadingElement.style.display = show ? "flex" : "none";
        } else {
            console.error("Loading element not found");
        }
    };

    const displayRegistrationDetails = (details) => {
        let detailsHTML = '';
        for (const [key, value] of Object.entries(details)) {
            detailsHTML += `<p><strong>${key.replace(/([A-Z])/g, ' $1')}:</strong> ${value}</p>`;
        }
        statusDetailsContainer.innerHTML = detailsHTML;
        statusMessage.style.display = 'block';
    };

    newRegistrationButton.addEventListener('click', () => {
        registrationForm.style.display = 'block';
        statusForm.style.display = 'none';
        statusMessage.style.display = 'none';
        mainOptions.style.display = 'none';
    });

    checkStatusButton.addEventListener('click', () => {
        registrationForm.style.display = 'none';
        statusForm.style.display = 'block';
        statusMessage.style.display = 'none';
        mainOptions.style.display = 'none';
    });

    sendOtpButton.addEventListener("click", async () => {
        const email = emailInput.value;
        const name = nameInput.value;
        const sendOtpMessageContainer = document.querySelector(".send-otp-message");

        if (email && name) {
            showLoading(true);
            try {
                const response = await fetch("/send-otp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, name }),
                });

                const data = await response.text();
                showLoading(false);

                if (response.ok) {
                    otpSection.style.display = "block";
                    displayMessage("OTP sent to your email.", "success", sendOtpMessageContainer);
                    sendOtpButton.disabled = true;
                    startTimer(60, timerElement, resendOtpTimer, sendOtpButton);
                } else {
                    displayMessage(data, "error", sendOtpMessageContainer);
                }
            } catch (error) {
                showLoading(false);
                displayMessage("Error sending OTP. Please try again.", "error", sendOtpMessageContainer);
                console.error("Error:", error);
            }
        } else {
            displayMessage("Please enter your name and email address.", "error", sendOtpMessageContainer);
        }
    });

    verifyOtpButton.addEventListener("click", async () => {
        const email = emailInput.value;
        const otp = otpInput.value;
        const verifyOtpMessageContainer = document.querySelector(".verify-otp-message");
        const sendOtpMessageContainer = document.querySelector(".send-otp-message");

        if (email && otp) {
            showLoading(true);
            try {
                const response = await fetch("/verify-otp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, otp }),
                });

                const data = await response.text();
                showLoading(false);

                if (response.ok) {
                    emailVerified = true;
                    displayMessage("OTP verified successfully.", "success", sendOtpMessageContainer);
                    otpSection.style.display = "none";
                    step1.style.display = "none";
                    step2.style.display = "block";
                    registerButton.disabled = false;
                } else {
                    displayMessage(data, "error", verifyOtpMessageContainer);
                }
            } catch (error) {
                showLoading(false);
                displayMessage("Error verifying OTP. Please try again.", "error", verifyOtpMessageContainer);
                console.error("Error:", error);
            }
        } else {
            displayMessage("Please enter the OTP.", "error", verifyOtpMessageContainer);
        }
    });

    photoInput.addEventListener("change", () => {
        const photo = photoInput.files[0];
        const photoError = document.querySelector(".photo-error");
        const photoMessageContainer = document.querySelector(".photo-message");

        if (photo) {
            const validTypes = ["image/jpeg", "image/png"];
            if (!validTypes.includes(photo.type)) {
                displayMessage("Photo must be in .jpg, .jpeg, or .png format", "error", photoError);
                photoError.style.display = "block";
                photoMessageContainer.style.display = "none";
                photoValid = false;
                return;
            }
            if (photo.size > 500 * 1024) {
                displayMessage("Photo must not exceed 500KB", "error", photoError);
                photoError.style.display = "block";
                photoMessageContainer.style.display = "none";
                photoValid = false;
                return;
            }

            displayMessage("Photo accepted.", "success", photoMessageContainer);
            photoError.style.display = "none";
            photoValid = true;
        }
    });

    registrationForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const requiredInputs = registrationForm.querySelectorAll("input[required]");
        let allFilled = true;

        requiredInputs.forEach((input) => {
            if (!input.value) {
                allFilled = false;
            }
        });

        if (!allFilled) {
            displayMessage("Please fill all the fields before proceeding.", "error", messageContainer);
            return;
        }

        if (!photoValid) {
            displayMessage("Please upload a valid photo", "error", messageContainer);
            return;
        }

        if (!emailVerified) {
            displayMessage("Error: Verify your email first!", "error", messageContainer);
            return;
        }

        const formData = new FormData(registrationForm);
        showLoading(true);

        try {
            const response = await fetch("/register", {
                method: "POST",
                body: formData,
            });

            const data = await response.text();
            showLoading(false);

            if (response.ok) {
                registrationForm.style.display = "none";
                thankYouMessage.style.display = "block";
            } else if (response.status === 400 && data === 'Duplicate Registrations Not Allowed') {
                displayMessage("Duplicate registration. Not Allowed! If you need to make any changes to your registration, contact our team.", "error", messageContainer);
            } else {
                displayMessage(data, "error", messageContainer);
            }
        } catch (error) {
            showLoading(false);
            displayMessage("Error registering. Please try again.", "error", messageContainer);
            console.error("Error:", error);
        }

        registerButton.disabled = true;
    });

    sendStatusOtpButton.addEventListener("click", async () => {
        const email = document.getElementById("statusEmail").value;
        const name = document.getElementById("statusName").value;
        const sendStatusOtpMessageContainer = document.querySelector(".send-status-otp-message");

        if (email && name) {
            showLoading(true);
            try {
                const response = await fetch("/send-status-otp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, name }),
                });

                const data = await response.text();
                showLoading(false);

                if (response.ok) {
                    otpSectionStatus.style.display = "block";
                    displayMessage("OTP sent to your email.", "success", sendStatusOtpMessageContainer);
                    sendStatusOtpButton.disabled = true;
                    startTimer(60, timerElementStatus, resendOtpTimerStatus, sendStatusOtpButton);
                } else {
                    displayMessage(data, "error", sendStatusOtpMessageContainer);
                }
            } catch (error) {
                showLoading(false);
                displayMessage("Error sending OTP. Please try again.", "error", sendStatusOtpMessageContainer);
                console.error("Error:", error);
            }
        } else {
            displayMessage("Please enter your name and email address.", "error", sendStatusOtpMessageContainer);
        }
    });

    verifyStatusOtpButton.addEventListener("click", async () => {
        const email = document.getElementById("statusEmail").value;
        const otp = statusOtpInput.value;
        const verifyStatusOtpMessageContainer = document.querySelector(".verify-status-otp-message");

        if (email && otp) {
            showLoading(true);
            try {
                const response = await fetch("/verify-status-otp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, otp }),
                });

                const data = await response.json();
                showLoading(false);

                if (response.ok) {
                    if (data.status === 'Found') {
                        displayRegistrationDetails(data.details);
                        statusForm.style.display = 'none';
                        statusMessage.style.display = 'block';
                        statusMessageText.textContent = data.message;
                    } else {
                        statusMessage.style.display = 'block';
                        statusMessageText.textContent = data.message;
                        statusDetailsContainer.innerHTML = '';
                        statusForm.style.display = 'none';
                    }
                } else {
                    displayMessage(data.message, "error", verifyStatusOtpMessageContainer);
                }
            } catch (error) {
                showLoading(false);
                displayMessage("Error verifying OTP. Please try again.", "error", verifyStatusOtpMessageContainer);
                console.error("Error:", error);
            }
        } else {
            displayMessage("Please enter the OTP.", "error", verifyStatusOtpMessageContainer);
        }
    });
});
