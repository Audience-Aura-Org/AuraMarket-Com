/**
 * controllers/upload.controller.js
 * Handles responses for uploaded files.
 */

const uploadSingle = (req, res) => {
  console.log(`📡 [API] Asset ingestion node triggered - Part: ${req.file ? 'exists' : 'missing'}, Type: ${req.body.type}`);
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  // 🚀 PATH DISCOVERY: Cloudinary uses .path (absolute URL), Local uses req.file.path
  let fileUrl = '';
  if (req.file.path && req.file.path.startsWith('http')) {
    fileUrl = req.file.path;
  } else if (req.file.path) {
    // Local: Normalize for Linux/Render and find the relative /uploads route
    const normalizedPath = req.file.path.replace(/\\/g, '/');
    const uploadsIndex = normalizedPath.lastIndexOf('/uploads');
    
    if (uploadsIndex !== -1) {
      fileUrl = normalizedPath.substring(uploadsIndex);
    } else {
      fileUrl = `/uploads/${req.body.type || 'general'}/${req.file.filename}`;
    }
  } else {
    fileUrl = `/uploads/${req.body.type || 'general'}/${req.file.filename}`;
  }

  console.log(`✅ [API] Asset normalized: ${fileUrl}`);

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
