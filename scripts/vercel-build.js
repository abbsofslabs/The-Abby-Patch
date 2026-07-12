const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const reactScripts = path.join(
  projectRoot,
  'node_modules',
  'react-scripts',
  'bin',
  'react-scripts.js'
);

if (!fs.existsSync(reactScripts)) {
  console.error('react-scripts is not installed. Run npm install first.');
  process.exit(1);
}

process.env.CI = 'false';
process.env.REACT_APP_SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || 'https://owlbtvtptenxtuqahogp.supabase.co';
process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93bGJ0dnRwdGVueHR1cWFob2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzODU5NjksImV4cCI6MjA5ODk2MTk2OX0.vco_4bcok3ylz5BXlqAhGXM8J1yoIHWwiWv3FySgEYE';

const build = spawnSync(process.execPath, [reactScripts, 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

if (build.status !== 0) {
  process.exit(build.status || 1);
}

fs.copyFileSync(
  path.join(projectRoot, 'build', 'index.html'),
  path.join(projectRoot, 'build', '404.html')
);
