/**
 * controllers/upload.controller.js
 * Handles responses for uploaded files.
 */

const uploadSingle = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  // 🚀 PATH DISCOVERY: Cloudinary uses .path (absolute URL), Local uses req.file.path (relative with subfolders)
  // Ensure we normalize backslashes (Windows) to forward slashes for URLs
  let fileUrl = req.file.path ? req.file.path.replace(/\\/g, '/') : `/uploads/${req.file.filename}`;
  
  // If it's a local path and doesn't start with a slash, add one
  if (!fileUrl.startsWith('http') && !fileUrl.startsWith('/')) {
    fileUrl = '/' + fileUrl;
  }

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
  
  const urls = req.files.map(file => {
    let url = file.path ? file.path.replace(/\\/g, '/') : `/uploads/${file.filename}`;
    if (!url.startsWith('http') && !url.startsWith('/')) url = '/' + url;
    return { url, filename: file.filename };
  });

  res.status(200).json({
    success: true,
    data: { urls }
  });
};

module.exports = {
  uploadSingle,
  uploadMultiple
};
