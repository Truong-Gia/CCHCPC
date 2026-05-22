## Firebase Authentication Setup Guide

### Problem
Email/Password authentication is not enabled in Firebase Console. The app shows error:
```
Email/mật khẩu chưa được bật trong Firebase Console. 
Vui lòng vào Authentication → Sign-in method → bật Email/Password.
```

### Solution - Enable Email/Password in Firebase Console

Follow these steps to enable Email/Password authentication:

1. **Go to Firebase Console**
   - Visit https://console.firebase.google.com
   - Select your project

2. **Navigate to Authentication**
   - Left sidebar → "Build" → "Authentication"

3. **Go to Sign-in method tab**
   - Click on "Sign-in method" tab at the top

4. **Enable Email/Password Provider**
   - Find "Email/Password" in the list
   - Click on it to expand
   - Click the toggle button to ENABLE
   - Select "Email/password" option (not "Email link")
   - Click "Save"

5. **Test the App**
   - Reload the app
   - Try to sign up with a test email and password
   - Once one user is created, you can sign in

### Creating Test Accounts (Optional)

After enabling Email/Password, you can create test accounts manually in Firebase:

1. In Authentication → "Users" tab
2. Click "Create user" button  
3. Enter email and password
4. Click "Create user"

Test account example:
- Email: `admin@example.com`
- Password: `admin123456`

Role: After first sign up, edit user profile in Firestore:
- Collection: `users` → Document: `{uid}` → Add field `role: "admin"`

### Roles Configuration

After creating users, assign roles in Firestore:

**Default Role**: All new users get "viewer" role automatically

**To change role**:
1. Go to Firestore in Firebase Console
2. Find "users" collection
3. Open the user document (matches their UID)
4. Edit the "role" field to one of:
   - `admin` - Full access to all documents
   - `staff` - Can create and manage own documents
   - `viewer` - Read-only access

### Troubleshooting

**Error: "auth/operation-not-allowed"**
→ Email/Password is not enabled in Firebase Console

**Error: "auth/email-already-in-use"**
→ The email is already registered, try a different email

**Error: "auth/weak-password"**
→ Password must be at least 6 characters, use a stronger password

### Next Steps

Once Email/Password is enabled:
1. Sign up with an email and password
2. Open Firestore to assign the admin role to your account
3. Log in and start managing documents

Need help? Check the Firebase Console error messages for specific guidance.
