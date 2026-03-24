/**
 * controllers/upload.controller.js
 * Handles responses for uploaded files.
 */

const uploadSingle = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  // Construct the URL to the file
  const protocol = req.protocol;
  const host = req.get('host');
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

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

  const protocol = req.protocol;
  const host = req.get('host');
  
  const urls = req.files.map(file => ({
    url: `${protocol}://${host}/uploads/${file.filename}`,
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
