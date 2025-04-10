const express = require("express");
const multer = require("multer");
const {
  SignUp,
  ResendOTP,
  VerifyOTP,
  ForgotPassword,
  VerifyForgotPasswordOTP,
  ResetPassword,
  SignIn,
  ForgotPasswordLink,
  ResetPasswordLink,
  UpdateUserProfile,
} = require("../users/users");
const {
  AddEmployee,
  DeleteEmployee,
  UpdateEmployee,
  RegisterOrUpdateBusiness,
  GetEmployeesByBusiness,
  GetUserById,
  GetBusinessByUserId,
  GetUserByIdReq,
  getCouponUsageForBusinessAdmin,
} = require("../business/business");
const { authenticate, isBusinessAdmin } = require("../Authentication/auth");
const {
  createOrUpdateOffer,
  deleteOffer,
  publishUnpublishOffer,
  publishedOfferList,
  businessOfferList,
} = require("../offers/offers");
const uploadImageCloudinary = require("../Cloundinary/imageUpload");
const {
  createTransaction,
  getTransaction,
  UpdateTransaction,
} = require("../transaction/transaction");
const {
  RedeemCoupon,
  UseCoupon,
  GetRedeemedCouponsWithUsage,
  GetCouponUsageDetails,
  GetBusinessEmployeesWithCoupons,
  getValidCouponsForUser,
} = require("../coupon/coupon");
const router = express.Router();

const storage = multer.diskStorage({});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 10,
  },
});

// User Apis
router.post("/SignUp", SignUp);
router.post("/resend-otp", ResendOTP);
router.post("/verify-otp", VerifyOTP);
router.post("/signin", SignIn);
router.post("/forgot-password", ForgotPasswordLink);
router.post("/reset-password", ResetPasswordLink);
router.put("/update-profile", authenticate, UpdateUserProfile);

//get user details
router.get("/user-details", authenticate, GetUserById);
router.get("/user-details-byId", authenticate, isBusinessAdmin, GetUserByIdReq);
router.get(
  "/valid-coupons",
  authenticate,
  isBusinessAdmin,
  getValidCouponsForUser
);
router.get(
  "/coupon-usage-business",
  authenticate,
  isBusinessAdmin,
  getCouponUsageForBusinessAdmin
);
router.get(
  "/business-details",
  authenticate,
  isBusinessAdmin,
  GetBusinessByUserId
);
router.get(
  "/employee-history",
  authenticate,
  isBusinessAdmin,
  GetBusinessEmployeesWithCoupons
);

// Register business and manage employee
router.post("/register-business", authenticate, RegisterOrUpdateBusiness);
router.get("/employee-list", authenticate, GetEmployeesByBusiness);
router.post("/add-employee", authenticate, AddEmployee);
router.put("/update-employee", authenticate, UpdateEmployee);
router.delete("/delete-employees", authenticate, DeleteEmployee);

// Offers
router.post(
  "/create-offer",
  authenticate,
  isBusinessAdmin,
  createOrUpdateOffer
);
router.delete("/delete-offer", authenticate, isBusinessAdmin, deleteOffer);
router.post(
  "/publish-offer",
  authenticate,
  isBusinessAdmin,
  publishUnpublishOffer
);
router.get("/publish-offer-list", authenticate, publishedOfferList);
router.get(
  "/business-offer-list",
  authenticate,
  isBusinessAdmin,
  businessOfferList
);

//coupons related apis
router.post("/redeem-coupon", authenticate, RedeemCoupon);
router.post("/use-coupon", authenticate, isBusinessAdmin, UseCoupon);
router.get("/redeemed-coupons", authenticate, GetRedeemedCouponsWithUsage);
router.get("/coupon-usage", authenticate, GetCouponUsageDetails);

//transactions
router.post("/transactions", authenticate, createTransaction);
router.get("/transactions_Details", authenticate, getTransaction);
router.put("/update_transactions", authenticate, UpdateTransaction);

//image upload
router.post("/upload-image", upload.single("image"), uploadImageCloudinary);

module.exports = router;
