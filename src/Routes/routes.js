const express = require("express");
const multer = require("multer");

const user = require("../users/users");
const auth = require("../Authentication/auth");
const business = require("../business/business");
const offers = require("../offers/offers");
const transaction = require("../transaction/transaction");
const coupon = require("../coupon/coupon");
const router = express.Router();
const uploadImageCloudinary = require("../Cloundinary/imageUpload");

const storage = multer.diskStorage({});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 10,
  },
});

// User Apis
router.post("/SignUp", user.SignUp);
router.post("/resend-otp", user.ResendOTP);
router.post("/verify-otp", user.VerifyOTP);
router.post("/signin", user.SignIn);
router.post("/forgot-password", user.ForgotPasswordLink);
router.post("/reset-password", user.ResetPasswordLink);
router.put("/update-profile", auth.authenticate, user.UpdateUserProfile);

router.post("/google_register", user.googleRegister);
router.post("/google_signIn", user.googleSignIn);

//get user details
router.get("/user-details", auth.authenticate, business.GetUserById);
router.get("/user-details-byId", auth.authenticate, auth.isBusinessAdmin, business.GetUserByIdReq);
router.get("/valid-coupons", auth.authenticate, auth.isBusinessAdmin, coupon.getValidCouponsForUser);
router.get("/coupon-usage-business", auth.authenticate, auth.isBusinessAdmin, business.getCouponUsageForBusinessAdmin);
router.get("/business-details", auth.authenticate, auth.isBusinessAdmin, business.GetBusinessByUserId);
router.get("/employee-history", auth.authenticate, auth.isBusinessAdmin, coupon.GetBusinessEmployeesWithCoupons);

// Register business and manage employee
// router.post("/register-business", auth.authenticate, business.RegisterOrUpdateBusiness);
router.post("/update-business", auth.authenticate, business.UpdateBusiness);
router.get("/employee-list", auth.authenticate, business.GetEmployeesByBusiness);
router.post("/add-employee", auth.authenticate, business.AddEmployee);
router.put("/update-employee", auth.authenticate, business.UpdateEmployee);
router.delete("/delete-employees", auth.authenticate, business.DeleteEmployee);

// Offers
router.post("/create-offer", auth.authenticate, auth.isBusinessAdmin, offers.createOrUpdateOffer);
router.delete("/delete-offer", auth.authenticate, auth.isBusinessAdmin, offers.deleteOffer);
router.post("/publish-offer", auth.authenticate, auth.isBusinessAdmin, offers.publishUnpublishOffer);
router.get("/publish-offer-list", auth.authenticate, offers.publishedOfferList);
router.get("/business-offer-list", auth.authenticate, auth.isBusinessAdmin, offers.businessOfferList);

//coupons related apis
router.post("/redeem-coupon", auth.authenticate, coupon.RedeemCoupon);
router.post("/use-coupon", auth.authenticate, auth.isBusinessAdmin, coupon.UseCoupon);
router.get("/redeemed-coupons", auth.authenticate, coupon.GetRedeemedCouponsWithUsage);
router.get("/coupon-usage", auth.authenticate, coupon.GetCouponUsageDetails);

//transactions
router.post("/transactions", auth.authenticate, transaction.createTransaction);
router.get("/transactions_Details", auth.authenticate, transaction.getTransaction);
router.put("/update_transactions", auth.authenticate, transaction.UpdateTransaction);

//image upload
router.post("/upload-image", upload.single("image"), uploadImageCloudinary);



module.exports = router;
