export const isNative = (platform: string, arch = process.env.RUNNER_ARCH) => {
  switch (arch?.toUpperCase()) {
    case 'X64': return platform === 'linux/amd64'
    case 'ARM64': return platform === 'linux/arm64' || platform === 'linux/arm64/v8'
    case 'ARM': return platform === 'linux/arm/v7'
    default: return false
  }
}
