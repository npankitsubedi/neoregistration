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
  let photoValid = false;
  let timer;

  const displayMessage = (message, type, container) => {
    if (container) {
      container.innerHTML = `<p style="color: ${type === 'error' ? 'red' : 'green'}; font-weight: bold;">${message}</p>`;
    } else {
      console.error("Message container not found");
    }
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

  const showLoading = (show) => {
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.style.display = show ? "flex" : "none";
    } else {
      console.error("Loading element not found");
    }
  };


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
        console.log("Response status:", response.status);
        console.log("Response text:", data);

        if (response.ok) {
          otpSection.style.display = "block";
          displayMessage("OTP sent to your email.", "success", sendOtpMessageContainer);
          sendOtpButton.disabled = true;
          startTimer(60);
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
        console.log("Response status:", response.status);
        console.log("Response text:", data);

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
      console.log("Response status:", response.status);
      console.log("Response text:", data);

      if (response.ok) {
        registrationForm.style.display = "none";
        thankYouMessage.style.display = "block";
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
});
