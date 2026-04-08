/**
 * controllers/upload.controller.js
 * Handles responses for uploaded files (S3, Cloudinary, or Local).
 */

const uploadSingle = (req, res) => {
  console.log(`📡 [API] Asset ingestion node triggered - Part: ${req.file ? 'exists' : 'missing'}, Type: ${req.body.type}`);
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  // 🚀 PATH DISCOVERY: Handle S3, Cloudinary, and Local uploads
  let fileUrl = '';
  
  // S3: req.file.location is the S3 URL
  if (req.file.location) {
    fileUrl = req.file.location;
    console.log(`✅ [API] S3 Asset URL: ${fileUrl}`);
  }
  // Cloudinary: req.file.path is the Cloudinary URL
  else if (req.file.path && req.file.path.startsWith('http')) {
    fileUrl = req.file.path;
    console.log(`✅ [API] Cloudinary Asset URL: ${fileUrl}`);
  }
  // Local: Normalize for Linux/Render
  else if (req.file.path) {
    const normalizedPath = req.file.path.replace(/\\/g, '/');
    const uploadsIndex = normalizedPath.lastIndexOf('/uploads');
    
    if (uploadsIndex !== -1) {
      fileUrl = normalizedPath.substring(uploadsIndex);
    } else {
      fileUrl = `/uploads/${req.body.type || 'general'}/${req.file.filename}`;
    }
    console.log(`✅ [API] Local Asset normalized: ${fileUrl}`);
  } else {
    fileUrl = `/uploads/${req.body.type || 'general'}/${req.file.filename}`;
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
    
    // S3: req.file.location is the S3 URL
    if (file.location) {
      fileUrl = file.location;
    }
    // Cloudinary: file.path is the Cloudinary URL
    else if (file.path && file.path.startsWith('http')) {
      fileUrl = file.path;
    }
    // Local: Normalize path
    else if (file.path) {
      const normalizedPath = file.path.replace(/\\/g, '/');
      const uploadsIndex = normalizedPath.lastIndexOf('/uploads');
      if (uploadsIndex !== -1) {
        fileUrl = normalizedPath.substring(uploadsIndex);
      } else {
        fileUrl = `/uploads/${req.body.type || 'others'}/${file.filename}`;
      }
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
