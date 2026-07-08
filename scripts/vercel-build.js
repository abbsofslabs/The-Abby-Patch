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
