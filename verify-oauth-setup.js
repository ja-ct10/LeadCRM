/**
 * Google OAuth Configuration Verification Script
 * 
 * This script verifies that all required configuration for Google OAuth is in place.
 * Run with: node verify-oauth-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Google OAuth Configuration...\n');

const checks = [];

// Check 1: Frontend .env.local file
const frontendEnvPath = path.join(__dirname, 'frontend', '.env.local');
try {
  const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
  
  const hasGoogleClientId = frontendEnv.includes('GOOGLE_CLIENT_ID=');
  const hasGoogleSecret = frontendEnv.includes('GOOGLE_CLIENT_SECRET=');
  const hasNextAuthSecret = frontendEnv.includes('NEXTAUTH_SECRET=');
  const hasNextAuthUrl = frontendEnv.includes('NEXTAUTH_URL=');
  
  if (hasGoogleClientId && hasGoogleSecret && hasNextAuthSecret) {
    console.log('✅ Frontend .env.local: All required Google OAuth variables present');
    if (!hasNextAuthUrl) {
      console.log('   ⚠️  Warning: NEXTAUTH_URL not set (recommended for proper URL resolution)');
    }
    checks.push(true);
  } else {
    console.log('❌ Frontend .env.local: Missing required variables');
    if (!hasGoogleClientId) console.log('   - Missing: GOOGLE_CLIENT_ID');
    if (!hasGoogleSecret) console.log('   - Missing: GOOGLE_CLIENT_SECRET');
    if (!hasNextAuthSecret) console.log('   - Missing: NEXTAUTH_SECRET');
    checks.push(false);
  }
} catch (error) {
  console.log(`❌ Frontend .env.local: File not found at ${frontendEnvPath}`);
  checks.push(false);
}

console.log('');

// Check 2: Backend .env file
const backendEnvPath = path.join(__dirname, 'backend', '.env');
try {
  const backendEnv = fs.readFileSync(backendEnvPath, 'utf8');
  
  const hasGoogleOAuthClientId = backendEnv.includes('GOOGLE_OAUTH_CLIENT_ID=');
  const hasGoogleOAuthSecret = backendEnv.includes('GOOGLE_OAUTH_CLIENT_SECRET=');
  
  if (hasGoogleOAuthClientId && hasGoogleOAuthSecret) {
    console.log('✅ Backend .env: All required Google OAuth variables present');
    checks.push(true);
  } else {
    console.log('❌ Backend .env: Missing required variables');
    if (!hasGoogleOAuthClientId) console.log('   - Missing: GOOGLE_OAUTH_CLIENT_ID');
    if (!hasGoogleOAuthSecret) console.log('   - Missing: GOOGLE_OAUTH_CLIENT_SECRET');
    checks.push(false);
  }
} catch (error) {
  console.log(`❌ Backend .env: File not found at ${backendEnvPath}`);
  checks.push(false);
}

console.log('');

// Check 3: NextAuth auth-options.ts file
const authOptionsPath = path.join(__dirname, 'frontend', 'app', 'api', 'auth', '[...nextauth]', 'auth-options.ts');
try {
  const authOptions = fs.readFileSync(authOptionsPath, 'utf8');
  
  const hasGoogleProvider = authOptions.includes('GoogleProvider');
  const readsClientId = authOptions.includes('GOOGLE_CLIENT_ID');
  const readsClientSecret = authOptions.includes('GOOGLE_CLIENT_SECRET');
  
  if (hasGoogleProvider && readsClientId && readsClientSecret) {
    console.log('✅ NextAuth configuration: GoogleProvider properly configured');
    checks.push(true);
  } else {
    console.log('❌ NextAuth configuration: GoogleProvider setup incomplete');
    checks.push(false);
  }
} catch (error) {
  console.log(`❌ NextAuth configuration: File not found at ${authOptionsPath}`);
  checks.push(false);
}

console.log('');

// Check 4: Backend OAuth route
const authRoutesPath = path.join(__dirname, 'backend', 'src', 'api', 'routes', 'auth.routes.ts');
try {
  const authRoutes = fs.readFileSync(authRoutesPath, 'utf8');
  
  const hasOAuthRoute = authRoutes.includes("'/oauth/google'") || authRoutes.includes('"/oauth/google"');
  const hasOAuthController = authRoutes.includes('authController.oauthGoogle');
  
  if (hasOAuthRoute && hasOAuthController) {
    console.log('✅ Backend OAuth route: /api/v1/auth/oauth/google endpoint registered');
    checks.push(true);
  } else {
    console.log('❌ Backend OAuth route: OAuth endpoint not properly registered');
    checks.push(false);
  }
} catch (error) {
  console.log(`❌ Backend OAuth route: File not found at ${authRoutesPath}`);
  checks.push(false);
}

console.log('');

// Check 5: Backend OAuth controller
const authControllerPath = path.join(__dirname, 'backend', 'src', 'core', 'auth', 'auth.controller.ts');
try {
  const authController = fs.readFileSync(authControllerPath, 'utf8');
  
  const hasOAuthFunction = authController.includes('export async function oauthGoogle');
  const hasOAuthLogic = authController.includes('findOrCreateUserByOAuth');
  
  if (hasOAuthFunction && hasOAuthLogic) {
    console.log('✅ Backend OAuth controller: oauthGoogle handler implemented');
    checks.push(true);
  } else {
    console.log('❌ Backend OAuth controller: oauthGoogle handler incomplete');
    checks.push(false);
  }
} catch (error) {
  console.log(`❌ Backend OAuth controller: File not found at ${authControllerPath}`);
  checks.push(false);
}

console.log('');

// Check 6: AuthContext integration
const authContextPath = path.join(__dirname, 'frontend', 'src', 'store', 'AuthContext.tsx');
try {
  const authContext = fs.readFileSync(authContextPath, 'utf8');
  
  const hasLoginWithGoogle = authContext.includes('const loginWithGoogle');
  const callsNextAuthSignIn = authContext.includes("nextAuthSignIn('google'");
  
  if (hasLoginWithGoogle && callsNextAuthSignIn) {
    console.log('✅ AuthContext: loginWithGoogle() properly implemented');
    checks.push(true);
  } else {
    console.log('❌ AuthContext: loginWithGoogle() not properly implemented');
    checks.push(false);
  }
} catch (error) {
  console.log(`❌ AuthContext: File not found at ${authContextPath}`);
  checks.push(false);
}

console.log('');
console.log('━'.repeat(60));

const passedChecks = checks.filter(Boolean).length;
const totalChecks = checks.length;

if (passedChecks === totalChecks) {
  console.log(`\n✅ All checks passed (${passedChecks}/${totalChecks})`);
  console.log('\n📋 Next Steps:');
  console.log('   1. Restart the frontend dev server:');
  console.log('      npm --prefix frontend run dev');
  console.log('   2. Navigate to http://localhost:3000/login');
  console.log('   3. Click "Continue with Google"');
  console.log('   4. Verify redirect to Google consent screen works');
  console.log('\n⚠️  Important: Environment variable changes require a server restart!');
} else {
  console.log(`\n❌ ${totalChecks - passedChecks} check(s) failed`);
  console.log('\nPlease fix the issues above before testing Google OAuth login.');
}

console.log('');
