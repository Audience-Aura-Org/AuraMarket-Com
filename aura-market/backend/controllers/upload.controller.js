/**
 * controllers/upload.controller.js
 * Handles responses for uploaded files.
 */

const uploadSingle = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  // 🚀 PATH DISCOVERY: Cloudinary uses .path (absolute URL), Local uses req.file.path
  // If it's a Cloudinary URL, use it directly.
  // If it's a local path, we need to extract the relative path starting from 'uploads'
  let fileUrl = '';
  if (req.file.path && req.file.path.startsWith('http')) {
    fileUrl = req.file.path;
  } else if (req.file.path) {
    // Local: The path might be absolute. Find the index of 'uploads' and take everything from there.
    const normalizedPath = req.file.path.replace(/\\/g, '/');
    const uploadsIndex = normalizedPath.lastIndexOf('/uploads/');
    if (uploadsIndex !== -1) {
      fileUrl = normalizedPath.substring(uploadsIndex);
    } else {
      // Fallback if 'uploads' not found in path (should not happen with our storage config)
      fileUrl = `/uploads/${req.body.type || 'others'}/${req.file.filename}`;
    }
  } else {
    fileUrl = `/uploads/${req.body.type || 'others'}/${req.file.filename}`;
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
    let fileUrl = '';
    if (file.path && file.path.startsWith('http')) {
      fileUrl = file.path;
    } else if (file.path) {
      const normalizedPath = file.path.replace(/\\/g, '/');
      const uploadsIndex = normalizedPath.lastIndexOf('/uploads/');
      if (uploadsIndex !== -1) fileUrl = normalizedPath.substring(uploadsIndex);
      else fileUrl = `/uploads/${req.body.type || 'others'}/${file.filename}`;
    } else {
      fileUrl = `/uploads/${req.body.type || 'others'}/${file.filename}`;
    }
    return { url: fileUrl, filename: file.filename };
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
