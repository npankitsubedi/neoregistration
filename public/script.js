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

    let emailVerified = false;
    let timer;

    const displayMessage = (message, type, container) => {
        container.innerHTML = `<p style="color: ${type === 'error' ? 'red' : 'green'}; font-weight: bold;">${message}</p>`;
    };

    const startTimer = (duration) => {
        let timeRemaining = duration;
        resendOtpTimer.style.display = "block";
        timerElement.textContent = timeRemaining;
        timer = setInterval(() => {
            timeRemaining--;
            timerElement.textContent = timeRemaining;
            if (timeRemaining <= 0) {
                clearInterval(timer);
                resendOtpTimer.style.display = "none";
                sendOtpButton.disabled = false;
            }
        }, 1000);
    };

    const disableSendOtpButton = () => {
        sendOtpButton.disabled = true;
        startTimer(60);
    };

    const showLoading = () => {
        loadingElement.style.display = "block";
        setTimeout(() => {
            loadingElement.style.display = "none";
        }, 5000);
    };

    sendOtpButton.addEventListener("click", () => {
        const email = emailInput.value;
        const name = nameInput.value;
        const sendOtpMessageContainer = document.querySelector(".send-otp-message");

        if (email && name) {
            fetch("/send-otp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, name }),
            })
                .then((response) => response.text())
                .then((data) => {
                    if (data === "OTP sent") {
                        otpSection.style.display = "block";
                        displayMessage("OTP sent to your email.", "success", sendOtpMessageContainer);
                        disableSendOtpButton();
                    } else {
                        displayMessage("Error sending OTP. Please try again.", "error", sendOtpMessageContainer);
                    }
                })
                .catch((error) => {
                    displayMessage("Error sending OTP. Please try again.", "error", sendOtpMessageContainer);
                    console.error("Error:", error);
                });
        } else {
            displayMessage("Please enter your name and email address.", "error", sendOtpMessageContainer);
        }
    });

    verifyOtpButton.addEventListener("click", () => {
        const email = emailInput.value;
        const otp = otpInput.value;
        const verifyOtpMessageContainer = document.querySelector(".verify-otp-message");
        const sendOtpMessageContainer = document.querySelector(".send-otp-message");

        if (email && otp) {
            fetch("/verify-otp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, otp }),
            })
                .then((response) => response.text())
                .then((data) => {
                    if (data === "OTP verified") {
                        emailVerified = true;
                        displayMessage("OTP verified successfully.", "success", sendOtpMessageContainer);
                        otpSection.style.display = "none";
                        step1.style.display = "none";
                        step2.style.display = "block";
                        registerButton.disabled = false;
                    } else {
                        displayMessage("Invalid OTP. Please try again.", "error", verifyOtpMessageContainer);
                    }
                })
                .catch((error) => {
                    displayMessage("Error verifying OTP. Please try again.", "error", verifyOtpMessageContainer);
                    console.error("Error:", error);
                });
        } else {
            displayMessage("Please enter the OTP.", "error", verifyOtpMessageContainer);
        }
    });

    photoInput.addEventListener("change", () => {
        const photo = photoInput.files[0];
        const photoError = document.querySelector(".photo-error");

        if (photo) {
            const validTypes = ["image/jpeg", "image/png"];
            if (!validTypes.includes(photo.type)) {
                displayMessage("Photo must be in .jpg, .jpeg, or .png format", "error", photoError);
                photoError.style.display = "block";
                return;
            }
            if (photo.size > 500 * 1024) {
                displayMessage("Photo must not exceed 500KB", "error", photoError);
                photoError.style.display = "block";
                return;
            }

            photoError.style.display = "none";
        }
    });

    registrationForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const photo = photoInput.files[0];
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

        if (photo) {
            const validTypes = ["image/jpeg", "image/png"];
            if (!validTypes.includes(photo.type)) {
                displayMessage("Photo must be in .jpg, .jpeg, or .png format", "error", photoInput.parentElement);
                return;
            }
            if (photo.size > 500 * 1024) {
                displayMessage("Photo must not exceed 500KB", "error", photoInput.parentElement);
                return;
            }
        } else {
            displayMessage("Please upload a photo", "error", photoInput.parentElement);
            return;
        }

        if (!emailVerified) {
            displayMessage("Error: Verify your email first!", "error", messageContainer);
            return;
        }

        const formData = new FormData(registrationForm);
        showLoading();

        fetch("/register", {
            method: "POST",
            body: formData,
        })
            .then((response) => response.text())
            .then((data) => {
                loadingElement.style.display = "none";
                if (data === "Registration successful") {
                    registrationForm.style.display = "none";
                    thankYouMessage.style.display = "block";
                } else {
                    displayMessage(data, "error", messageContainer);
                }
            })
            .catch((error) => {
                loadingElement.style.display = "none";
                displayMessage("Error registering. Please try again.", "error", messageContainer);
                console.error("Error:", error);
            });

        registerButton.disabled = true;
    });
});
