/**
 * Generate Self-Signed Certificates for Local Development
 * 
 * Uses node-forge to create certificates without requiring OpenSSL or mkcert.
 * This is for local development only - not for production use.
 */

const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERT_DIR = path.join(__dirname, '..', 'nginx', 'ssl');
const CERT_FILE = path.join(CERT_DIR, 'vulnerax.local.crt');
const KEY_FILE = path.join(CERT_DIR, 'vulnerax.local.key');

function generateCertificates() {
  console.log('🔧 Generating self-signed certificates for local development...\n');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    console.log('✅ Created SSL directory');
  }
  
  // Check if certificates already exist
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    console.log('✅ Certificates already exist');
    console.log(`   Certificate: ${CERT_FILE}`);
    console.log(`   Key: ${KEY_FILE}\n`);
    return;
  }
  
  try {
    console.log('⏳ Generating 2048-bit RSA key pair...');
    
    // Generate a key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // Create a certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    // Subject and issuer attributes
    const attrs = [
      { name: 'commonName', value: 'vulnerax.local' },
      { name: 'countryName', value: 'US' },
      { name: 'stateOrProvinceName', value: 'Local' },
      { name: 'localityName', value: 'Development' },
      { name: 'organizationName', value: 'VulneraX' },
      { name: 'organizationalUnitName', value: 'Development' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    // Subject Alternative Names (SANs)
    const sans = [
      { type: 2, value: 'vulnerax.local' },
      { type: 2, value: '*.vulnerax.local' },
      { type: 2, value: 'www.vulnerax.local' },
      { type: 2, value: 'tenant1.vulnerax.local' },
      { type: 2, value: 'tenant2.vulnerax.local' },
      { type: 2, value: 'admin.vulnerax.local' },
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
      { type: 7, ip: '::1' }
    ];
    
    cert.setExtensions([
      {
        name: 'subjectAltName',
        altNames: sans
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true
      }
    ]);
    
    // Self-sign the certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());
    
    // Convert to PEM
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    
    // Save files
    fs.writeFileSync(CERT_FILE, certPem);
    fs.writeFileSync(KEY_FILE, keyPem);
    
    console.log('✅ Certificates generated successfully!\n');
    console.log(`📁 Certificate: ${CERT_FILE}`);
    console.log(`📁 Key: ${KEY_FILE}\n`);
    console.log('⚠️  WARNING: These are self-signed certificates.');
    console.log('   You will see a browser warning. Click "Advanced" → "Proceed anyway"\n');
    
  } catch (error) {
    console.error('❌ Failed to generate certificates:', error.message);
    console.log('');
    console.log('📋 To manually generate certificates:');
    console.log('   1. Install OpenSSL or mkcert');
    console.log('   2. Run one of these commands:');
    console.log('');
    console.log('   Using mkcert (recommended):');
    console.log('      mkcert -install');
    console.log('      mkcert -cert-file nginx/ssl/vulnerax.local.crt -key-file nginx/ssl/vulnerax.local.key vulnerax.local *.vulnerax.local localhost 127.0.0.1');
    console.log('');
    console.log('   Using OpenSSL:');
    console.log('      openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/ssl/vulnerax.local.key -out nginx/ssl/vulnerax.local.crt -subj "/CN=vulnerax.local"');
    console.log('');
    process.exit(1);
  }
}

// Update hosts file (requires admin, so we'll just show instructions)
function showHostsInstructions() {
  console.log('📋 To complete setup, add the following to your hosts file:');
  console.log('   Location: C:\\Windows\\System32\\drivers\\etc\\hosts\n');
  console.log('   127.0.0.1    vulnerax.local');
  console.log('   127.0.0.1    www.vulnerax.local');
  console.log('   127.0.0.1    tenant1.vulnerax.local');
  console.log('   127.0.0.1    tenant2.vulnerax.local');
  console.log('   127.0.0.1    admin.vulnerax.local\n');
  console.log('   Or run this script as Administrator to update automatically.\n');
}

// Main
generateCertificates();
showHostsInstructions();
