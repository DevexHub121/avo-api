const express = require("express");
const multer = require("multer");

const user = require("../users/users");
const business = require("../business/business");
const offer = require("../offers/offers");
const coupon = require("../coupon/coupon");
const transaction = require("../transaction/transaction");
const auth = require("../Authentication/auth");
const uploadImageCloudinary = require("../Cloundinary/imageUpload");

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 10 } });

/* =======================User Authentication======================= */
router.post("/signup", user.SignUp);
router.post("/signin", user.SignIn);
router.post("/resend-otp", user.ResendOTP);
router.post("/verify-otp", user.VerifyOTP);
router.post("/forgot-password", user.ForgotPasswordLink);
router.post("/reset-password", user.ResetPasswordLink);
router.put("/update-profile", auth.authenticate, user.UpdateUserProfile);

/* =======================Google OAuth======================= */
router.post("/google_register", user.googleRegister);
router.post("/google_signin", user.googleSignIn);

/* =======================User Data======================= */
router.get("/user-details", auth.authenticate, user.GetUserById);
router.get("/user-details-byId", auth.authenticate, auth.isBusinessAdmin, user.GetUserByIdReq);

/* =======================Business & Employee======================= */
router.post("/update-business", auth.authenticate, business.UpdateBusiness);
router.get("/business-details", auth.authenticate, auth.isBusinessAdmin, business.GetBusinessByUserId);

router.post("/add-employee", auth.authenticate, business.AddEmployee);
router.put("/update-employee", auth.authenticate, business.UpdateEmployee);
router.delete("/delete-employees", auth.authenticate, business.DeleteEmployee);
router.get("/employee-list", auth.authenticate, business.GetEmployeesByBusiness);

/* =======================Offers======================= */
router.post("/create-offer", auth.authenticate, auth.isBusinessAdmin, offer.createOrUpdateOffer);
router.delete("/delete-offer", auth.authenticate, auth.isBusinessAdmin, offer.deleteOffer);
router.post("/publish-offer", auth.authenticate, auth.isBusinessAdmin, offer.publishUnpublishOffer);
router.get("/publish-offer-list", auth.authenticate, offer.publishedOfferList);
router.get("/business-offer-list", auth.authenticate, auth.isBusinessAdmin, offer.businessOfferList);

/* =======================Coupons======================= */
router.post("/redeem-coupon", auth.authenticate, coupon.RedeemCoupon);
router.post("/use-coupon", auth.authenticate, auth.isBusinessAdmin, coupon.UseCoupon);
router.get("/redeemed-coupons", auth.authenticate, coupon.GetRedeemedCouponsWithUsage);
router.get("/coupon-usage", auth.authenticate, coupon.GetCouponUsageDetails);
router.get("/valid-coupons", auth.authenticate, auth.isBusinessAdmin, coupon.getValidCouponsForUser);
router.get("/coupon-usage-business", auth.authenticate, auth.isBusinessAdmin, coupon.getCouponUsageForBusinessAdmin);
router.get("/employee-history", auth.authenticate, auth.isBusinessAdmin, coupon.GetBusinessEmployeesWithCoupons);

/* =======================Transactions======================= */
router.post("/transactions", auth.authenticate, transaction.createTransaction);
router.get("/transactions_details", auth.authenticate, transaction.getTransaction);
router.put("/update_transactions", auth.authenticate, transaction.UpdateTransaction);

/* =======================Image Upload======================= */
router.post("/upload-image", upload.single("image"), uploadImageCloudinary);

module.exports = router;
