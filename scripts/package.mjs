// Packages the production build for aerocat.tech: release/hoverlab-<version>.tar.gz
// (single top-level folder "hoverlab") plus a .sha256 file. Usage: npm run package [-- <version>]
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = (process.argv[2] ?? pkg.version).replace(/^v/, '');
if (version !== pkg.version) {
  console.error(`Version ${version} does not match package.json ${pkg.version}`);
  process.exit(1);
}

execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
rmSync('release', { recursive: true, force: true });
mkdirSync('release/hoverlab', { recursive: true });
cpSync('dist', 'release/hoverlab', { recursive: true });
writeFileSync('release/hoverlab/version.txt', `${version}\n`);

const file = `hoverlab-${version}.tar.gz`;
execFileSync('tar', ['--sort=name', '--owner=0', '--group=0', '--numeric-owner', '-czf', file, 'hoverlab'], { cwd: 'release', stdio: 'inherit' });
const sha = createHash('sha256').update(readFileSync(`release/${file}`)).digest('hex');
writeFileSync(`release/${file}.sha256`, `${sha}  ${file}\n`);
console.log(`release/${file}\n${sha}`);
