# Upload API Usage Guide

## Quick Start

### Single File Upload

**Endpoint:** `POST /api/upload/single`
**Base URL:** `http://13.51.198.119:5000` (AWS Backend)
**Authentication:** Required (JWT Bearer Token)

**cURL Example:**
```bash
curl -X POST http://13.51.198.119:5000/api/upload/single \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@path/to/image.jpg" \
  -F "type=products"
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "url": "https://aura-market-frontend.s3.eu-north-1.amazonaws.com/products/1775655431429-186132719-image.jpg",
    "filename": "image.jpg",
    "mimetype": "image/jpeg",
    "size": 123456,
    "method": "S3"
  }
}
```

---

### Multiple Files Upload

**Endpoint:** `POST /api/upload/multiple`
**Max Files:** 5 per request
**Authentication:** Required (JWT Bearer Token)

**cURL Example:**
```bash
curl -X POST http://13.51.198.119:5000/api/upload/multiple \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  -F "images=@image3.jpg" \
  -F "type=products"
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "urls": [
      "https://aura-market-frontend.s3.eu-north-1.amazonaws.com/products/...-image1.jpg",
      "https://aura-market-frontend.s3.eu-north-1.amazonaws.com/products/...-image2.jpg",
      "https://aura-market-frontend.s3.eu-north-1.amazonaws.com/products/...-image3.jpg"
    ],
    "uploadMethod": "S3"
  }
}
```

---

## Request Parameters

### Form Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` (single) | File | Yes | Image file to upload |
| `images` (multiple) | File[] | Yes | Up to 5 image files |
| `type` | String | No | S3 folder, default: "general" |

### Headers
| Header | Required | Example |
|--------|----------|---------|
| `Authorization` | Yes | `Bearer eyJhbGc...` |
| `Content-Type` | Auto | `multipart/form-data` |

---

## Error Responses

### 400 - Bad Request (No File)
```json
{
  "success": false,
  "message": "Please upload a file"
}
```

### 400 - Bad Request (Invalid File Type)
```json
{
  "success": false,
  "message": "Only image files are allowed"
}
```

### 400 - Bad Request (File Too Large)
```json
{
  "success": false,
  "message": "File too large. Maximum size is 5MB"
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 500 - Server Error
```json
{
  "success": false,
  "message": "Upload failed: [detailed error message]"
}
```

---

## File Constraints

| Constraint | Value |
|------------|-------|
| File Size Limit | 5MB per file |
| Batch Limit | 5 files per request |
| Allowed Types | All image/* MIME types (jpg, png, gif, webp, etc.) |
| Storage | AWS S3 (persistent) |
| Access | Public read via HTTPS |

---

## JavaScript/Frontend Example

```javascript
// Single file upload
async function uploadImage(file, token, type = 'products') {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('type', type);

  const response = await fetch('http://13.51.198.119:5000/api/upload/single', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('Upload successful!');
    console.log('S3 URL:', result.data.url);
    return result.data.url;
  } else {
    console.error('Upload failed:', result.message);
  }
}

// Batch upload
async function uploadImages(files, token, type = 'products') {
  const formData = new FormData();
  
  Array.from(files).forEach(file => {
    formData.append('images', file);
  });
  formData.append('type', type);

  const response = await fetch('http://13.51.198.119:5000/api/upload/multiple', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const result = await response.json();
  
  if (result.success) {
    console.log(`Uploaded ${result.data.count} files`);
    return result.data.urls;
  } else {
    console.error('Upload failed:', result.message);
  }
}
```

---

## React Component Example

```jsx
import { useState } from 'react';

export default function ImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'products');

    try {
      const response = await fetch(
        'http://13.51.198.119:5000/api/upload/single',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        }
      );

      const result = await response.json();
      
      if (result.success) {
        setImageUrl(result.data.url);
      } else {
        alert('Upload failed: ' + result.message);
      }
    } catch (error) {
      alert('Upload error: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleUpload}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
      {imageUrl && <img src={imageUrl} alt="Uploaded" />}
    </div>
  );
}
```

---

## Postman Collection

### Single Upload Request
```
POST http://13.51.198.119:5000/api/upload/single

Headers:
- Authorization: Bearer YOUR_TOKEN
- Content-Type: multipart/form-data

Body (form-data):
- image: [select file]
- type: products
```

### Multiple Upload Request
```
POST http://13.51.198.119:5000/api/upload/multiple

Headers:
- Authorization: Bearer YOUR_TOKEN
- Content-Type: multipart/form-data

Body (form-data):
- images: [select files - max 5]
- type: products
```

---

## S3 URL Format Reference

All uploaded files are stored with this structure:

```
https://aura-market-frontend.s3.eu-north-1.amazonaws.com/
  [type]/
    [timestamp]-[random]-[original-filename]
```

**Example:**
```
https://aura-market-frontend.s3.eu-north-1.amazonaws.com/products/1775655431429-186132719-myimage.jpg
```

- **Type:** Folder based on `type` parameter (default: "general")
- **Timestamp:** Unix milliseconds when file was uploaded
- **Random:** Random number to ensure filename uniqueness
- **Original Filename:** Original uploaded filename

---

## Troubleshooting

### "Upload failed: No authorization token"
**Cause:** Missing or invalid JWT token
**Fix:** Include valid `Authorization: Bearer TOKEN` header

### "File too large"
**Cause:** File exceeds 5MB limit
**Fix:** Compress file or split into smaller files

### "Only image files are allowed"
**Cause:** Uploaded file is not an image
**Fix:** Ensure file MIME type starts with `image/`

### S3 URL returns 403 Forbidden
**Cause:** Bucket policy issue (rare)
**Fix:** URL should be automatically public, contact admin if persists

### Upload timeout
**Cause:** Large file or slow network
**Fix:** Try smaller file or check network connection

---

## Production Checklist

Before going live:
- ✅ Test both single and batch uploads
- ✅ Verify S3 URLs are accessible
- ✅ Store returned URLs in database
- ✅ Display images properly in Next.js Image component
- ✅ Set up monitoring for upload failures
- ✅ Configure CloudFront CDN for faster image delivery (optional)
- ✅ Implement image compression before upload (optional)
- ✅ Add S3 bucket lifecycle policies (auto-delete old test files)

---

## Performance Tips

1. **Compress images** before upload to reduce file size
2. **Use batch upload** for multiple images (faster than sequential)
3. **Cache S3 URLs** in database to avoid re-uploads
4. **Use CloudFront** distribution for global faster delivery
5. **Implement image resizing** in backend for thumbnails

---

**Created:** January 5, 2025
**Version:** 1.0
**Status:** Production Ready ✅
