// 官网唯一的公开发布信息来源。发新版时只改这个文件，然后运行 `npm run verify:release`。
// 所有字段必须与 GitHub Release 的公开资产一致；verify-release.mjs 会逐项比对。

export type PlatformId = 'macos' | 'windows' | 'android' | 'ios';
export type Status = 'available' | 'testing' | 'planned' | 'unavailable';

export interface Asset {
  label: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
}

export interface Platform {
  platform: PlatformId;
  name: string;
  architecture?: string;
  requirement?: string;
  status: Status;
  statusLabel: string;
  signingStatus: string;
  assets: Asset[];
  notes: string[];
  installAnchor: string;
}

export interface ReleaseManifest {
  version: string;
  displayName: string;
  tag: string;
  publishedAt: string;
  prerelease: boolean;
  repo: string;
  platforms: Platform[];
  nextRelease: { version: string; status: 'unreleased' };
}

export const release: ReleaseManifest = {
  version: '0.1.0-beta.12.1',
  displayName: 'Beta12.1',
  tag: 'v0.1.0-beta.12.1',
  publishedAt: '2026-10-11T06:16:10Z',
  prerelease: true,
  repo: 'Wason-dev/ASTaria',
  platforms: [
    {
      platform: 'macos',
      name: 'macOS',
      architecture: 'Apple Silicon（arm64）',
      requirement: 'macOS 13 或更新版本，M 系列芯片。不支持 Intel Mac。',
      status: 'available',
      statusLabel: '可下载 · 预发布',
      signingStatus: 'ad-hoc 签名，未经 Apple 公证',
      assets: [
        {
          label: 'DMG 磁盘映像',
          fileName: 'ASTaria-0.1.0-beta.12.1-mac-arm64-adhoc.dmg',
          sizeBytes: 151587398,
          sha256: '9a6ddaeb36db9002d73030ecd32631c06c174a20651800599aa3805beffe4c85',
        },
      ],
      notes: [
        '首次打开可能出现「无法验证开发者」，需要在「系统设置 → 隐私与安全性」中手动允许。',
        '正式版的目标是 Apple Developer ID Application 签名，并完成 Hardened Runtime、公证与 staple。这些工作尚未完成。',
      ],
      installAnchor: 'macos',
    },
    {
      platform: 'windows',
      name: 'Windows',
      architecture: 'x64',
      requirement: 'Windows x64。Windows 10 有历史测试记录，本版成品未重新实机验收；Windows 11 未验收。',
      status: 'testing',
      statusLabel: '试验版',
      signingStatus: '未做 Authenticode 代码签名',
      assets: [
        {
          label: '安装程序',
          fileName: 'ASTaria-0.1.0-beta.12.1-win-x64-setup.exe',
          sizeBytes: 115947524,
          sha256: '82fd35fb99fbe6e9cd35e2eca558d111f0a70d5d3b74123c9846626bef665ba4',
        },
        {
          label: '便携包',
          fileName: 'ASTaria-0.1.0-beta.12.1-win-x64-portable.zip',
          sizeBytes: 159866053,
          sha256: '4063adc830c461be57dc8f0122b3892f59afdf978262fb275631595868030b94',
        },
      ],
      notes: [
        '本版成品的实机安装与交互、Windows 11、真实自动升级与失败回退均未验收。切页与展开聊天仍有卡顿反馈。',
        '可能出现 SmartScreen 提示，原因是安装包没有代码签名。请只从 GitHub Release 获取，并核对 SHA-256。',
      ],
      installAnchor: 'windows',
    },
    {
      platform: 'android',
      name: 'Android',
      status: 'unavailable',
      statusLabel: '暂不可用',
      signingStatus: '—',
      assets: [],
      notes: ['当前没有 Android 安装包。'],
      installAnchor: 'mobile',
    },
    {
      platform: 'ios',
      name: 'iOS',
      status: 'unavailable',
      statusLabel: '暂不可用',
      signingStatus: '—',
      assets: [],
      notes: [
        '当前没有 iOS 版本。',
        '如果将来对外测试，会通过 TestFlight 分发。TestFlight 是有有效期的测试分发，不等于公开正式版。',
      ],
      installAnchor: 'mobile',
    },
  ],
  nextRelease: { version: 'v1.0', status: 'unreleased' },
};

// ---- 派生值：页面只读这些，不手写 URL 与大小 ----

export const releaseUrl = `https://github.com/${release.repo}/releases/tag/${release.tag}`;
export const releasesIndexUrl = `https://github.com/${release.repo}/releases`;
export const repoUrl = `https://github.com/${release.repo}`;
export const assetUrl = (fileName: string) =>
  `https://github.com/${release.repo}/releases/download/${release.tag}/${fileName}`;
export const checksumUrl = (fileName: string) => `${assetUrl(fileName)}.sha256`;

export const formatSize = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MiB`;
export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
export const publishedDate = formatDate(release.publishedAt);
export const downloadablePlatforms = release.platforms.filter((p) => p.assets.length > 0);
