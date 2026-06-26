"use strict";
const express = require("express");
const router = express.Router();

const registrationController = require("../controllers/registrationController");
const orderController = require("../controllers/orderController");
const paymentController = require("../controllers/paymentController");
const { validateRegistration, validateOrder, validateVerify } = require("../middleware/validate");

// Step 1: save the lead as Pending (before payment).
router.post("/register", validateRegistration, registrationController.register);
// Step 2: create a Razorpay order (server-owned amount).
router.post("/create-order", validateOrder, orderController.createOrder);
// Step 3: verify the signature → mark Paid.
router.post("/verify-payment", validateVerify, paymentController.verifyPayment);

module.exports = router;
