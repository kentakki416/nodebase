const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// pnpm monorepo: watch all files under the monorepo root
config.watchFolders = [monorepoRoot]

// Resolve modules from both the project and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Package exports with react-native condition
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default']

// Force singleton packages by returning the exact file path.
// This ensures ALL require('react') calls resolve to the same physical file,
// regardless of where the requiring module lives.
const singletonPkgs = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Exact match: require('react') or require('react-native')
  if (singletonPkgs[moduleName]) {
    const pkgDir = singletonPkgs[moduleName]
    const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'))
    const mainFile = path.resolve(pkgDir, pkgJson.main || 'index.js')
    return {
      type: 'sourceFile',
      filePath: mainFile,
    }
  }

  // Subpath: require('react/jsx-runtime') etc.
  for (const [pkg, pkgDir] of Object.entries(singletonPkgs)) {
    if (moduleName.startsWith(pkg + '/')) {
      const subpath = moduleName.slice(pkg.length + 1)
      const filePath = path.resolve(pkgDir, subpath)
      // Try with .js extension if no extension
      const candidates = [filePath, filePath + '.js', filePath + '.json']
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return {
            type: 'sourceFile',
            filePath: candidate,
          }
        }
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
