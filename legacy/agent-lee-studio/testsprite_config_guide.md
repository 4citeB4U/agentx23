# TestSprite Configuration Guide for Agent Lee Studio

## Fill out the TestSprite form with these values:

### Testing Types
- **Mode**: `Frontend` ✅
  - ❌ Backend (not applicable)
  - ✅ **Frontend** (this is a React UI application)

### Scope
- **Test Scope**: `Codebase` ✅
  - ✅ **Codebase** (test entire application)
  - ❌ Code diff (use this for incremental changes)

### Test Account Info (Optional)
- **Test Account Username**: `<leave empty>` 
  - This application does NOT require authentication
  - No login credentials needed
  
- **Test Account Password**: `<leave empty>`
  - No password required

### Local Development Port
- **Port**: `3000` ✅
  - The Vite dev server is running on **http://localhost:3000**
  
- **Path**: `/` ✅
  - Application is accessible from root path
  - No special routing needed

### Product Specification Doc
- **Upload or Link**: Use the `product_spec.md` file in this same directory
  - You can copy the contents from `product_spec.md` and paste into the PRD field
  - Or upload the markdown file directly if the form supports file uploads

---

## Quick Summary for Form Submission:

```
Mode: Frontend
Scope: Codebase
Test Account Username: [empty]
Test Account Password: [empty]
Port: 3000
Path: /
Product Spec: [paste contents from product_spec.md or upload file]
```

## After Configuration
Once you've filled out the form and submitted it, TestSprite will:
1. Analyze the Product Requirements Document
2. Generate test cases for the key features
3. Create automated Playwright tests
4. Execute tests against http://localhost:3000
5. Generate a test report with results

Make sure your dev server (`npm run dev`) is still running before executing the tests!
