const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: "djtsjuqyi",
  api_key: "225368946457134",
  api_secret: "iGO_xUkipR8D_7a2M6ht7bs3IrA",
});

const uploadImageCloudinary = async (req, res) => {
  try {
    const imagePath = req.file.path.replace(/\\/g, "/");

    const imageUrl = await cloudinary.uploader.upload(imagePath);
    const secureUrl = imageUrl.secure_url;

    res.json({ status: 200, url: secureUrl });
  } catch (error) {
    res.json({ status: 500, error: error });
  }
};

module.exports = uploadImageCloudinary;
