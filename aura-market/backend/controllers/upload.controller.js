/**
 * controllers/upload.controller.js
 * Handles responses for uploaded files.
 */

const uploadSingle = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  // Use relative path to ensure environment portability (frontend handles origin)
  const fileUrl = `/uploads/${req.file.filename}`;

  res.status(200).json({
    success: true,
    data: {
      url: fileUrl,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    }
  });
};

const uploadMultiple = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'Please upload files' });
  }
  
  const urls = req.files.map(file => ({
    url: `/uploads/${file.filename}`,
    filename: file.filename
  }));

  res.status(200).json({
    success: true,
    data: { urls }
  });
};

module.exports = {
  uploadSingle,
  uploadMultiple
};
