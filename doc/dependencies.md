# 依赖升级记录（2026-10-28）

本次以官方源的最新稳定版为目标，同时更新直接依赖、可兼容的间接依赖、构建工具、GitHub Actions 和容器基础镜像。版本范围的下限已同步更新，实际解析结果由 `Cargo.lock` 和 `pnpm-lock.yaml` 固定；CI 使用 `--locked` / `--frozen-lockfile`。

版本核对来源：[crates.io API](https://crates.io/data-access)、[npm 官方 registry](https://registry.npmjs.org/)、各 Action 的官方 GitHub Releases、[Rust 稳定版清单](https://static.rust-lang.org/dist/channel-rust-stable.toml)、[Node.js 发布清单](https://nodejs.org/dist/index.json)、[Debian 稳定版说明](https://www.debian.org/releases/)。项目 `.npmrc` 明确使用 npm 官方源，避免镜像同步差异。

## Rust 直接依赖

以下 20 个直接依赖均使用核对时的最新稳定版。

| 依赖 | 锁定版本 | 使用方 |
|---|---|---|
| [argon2](https://crates.io/crates/argon2/0.6.0) | 0.6.0 | server |
| [axum](https://crates.io/crates/axum/0.8.9) | 0.8.9 | server |
| [chrono](https://crates.io/crates/chrono/0.4.45) | 0.4.45 | server |
| [futures-util](https://crates.io/crates/futures-util/0.3.34) | 0.3.34 | server, client |
| [getrandom](https://crates.io/crates/getrandom/0.4.3) | 0.4.3 | server |
| [jsonwebtoken](https://crates.io/crates/jsonwebtoken/11.1.0) | 11.1.0 | server |
| [portable-pty](https://crates.io/crates/portable-pty/0.9.0) | 0.9.0 | client |
| [rustls](https://crates.io/crates/rustls/0.23.46) | 0.23.46 | client |
| [serde](https://crates.io/crates/serde/1.0.229) | 1.0.229 | server, client |
| [serde_json](https://crates.io/crates/serde_json/1.0.154) | 1.0.154 | server, client |
| [sqlx](https://crates.io/crates/sqlx/0.9.0) | 0.9.0 | server |
| [tokio](https://crates.io/crates/tokio/1.54.1) | 1.54.1 | server, client |
| [tokio-tungstenite](https://crates.io/crates/tokio-tungstenite/0.30.0) | 0.30.0 | client |
| [toml](https://crates.io/crates/toml/1.1.8+spec-1.1.0) | 1.1.8+spec-1.1.0 | server, client |
| [tower](https://crates.io/crates/tower/0.5.3) | 0.5.3 | server |
| [tower-http](https://crates.io/crates/tower-http/0.7.1) | 0.7.1 | server |
| [tracing](https://crates.io/crates/tracing/0.1.44) | 0.1.44 | server, client |
| [tracing-subscriber](https://crates.io/crates/tracing-subscriber/0.3.23) | 0.3.23 | server, client |
| [url](https://crates.io/crates/url/2.5.8) | 2.5.8 | client |
| [uuid](https://crates.io/crates/uuid/1.29.0) | 1.29.0 | server, client |

## 前端直接依赖

以下 15 个 registry 依赖均使用核对时的最新稳定版。`@remote-claude/shared-types` 是仓库内的 `workspace:*` 包，无外部版本需要升级。

| 依赖 | 版本下限 |
|---|---|
| [@xterm/addon-fit](https://www.npmjs.com/package/@xterm/addon-fit) | 0.11.0 |
| [@xterm/xterm](https://www.npmjs.com/package/@xterm/xterm) | 6.0.0 |
| [react](https://www.npmjs.com/package/react) | 19.3.1 |
| [react-dom](https://www.npmjs.com/package/react-dom) | 19.3.1 |
| [react-router-dom](https://www.npmjs.com/package/react-router-dom) | 7.18.5 |
| [zustand](https://www.npmjs.com/package/zustand) | 5.0.16 |
| [@testing-library/jest-dom](https://www.npmjs.com/package/@testing-library/jest-dom) | 7.0.1 |
| [@testing-library/react](https://www.npmjs.com/package/@testing-library/react) | 16.3.3 |
| [@types/react](https://www.npmjs.com/package/@types/react) | 19.3.0 |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom) | 19.3.0 |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | 6.1.2 |
| [jsdom](https://www.npmjs.com/package/jsdom) | 30.1.3 |
| [typescript](https://www.npmjs.com/package/typescript) | 7.0.2 |
| [vite](https://www.npmjs.com/package/vite) | 8.3.5 |
| [vitest](https://www.npmjs.com/package/vitest) | 5.0.5 |

## 构建、CI 与容器

| 工具 | 使用版本 |
|---|---|
| Rust | 1.99.1，固定在 `rust-toolchain.toml`，Docker 使用 `rust:1.99.1-trixie` |
| Node.js | 26.12.1，固定在 `.node-version`，前端 CI 与部署构建共用 |
| pnpm | 12.15.0，固定在根 `package.json` 的 `packageManager` |
| git-cliff | 2.14.2，发布工作流固定版本 |
| Debian | 当前稳定系列 13（trixie），运行镜像 `debian:trixie-slim` |

Node 最低支持范围与 jsdom 30 一致：`^22.22.2 || ^24.15.0 || >=26.0.0`；本次使用 Node 26.12.1 验证。pnpm 12 的锁文件同时记录包管理器与项目依赖，必须使用项目指定的 pnpm 安装。

| GitHub Action | 固定版本 |
|---|---|
| [actions/cache](https://github.com/actions/cache/releases/tag/v6.1.0) | v6.1.0 |
| [actions/checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) | v7.0.1 |
| [actions/download-artifact](https://github.com/actions/download-artifact/releases/tag/v8.0.2) | v8.0.2 |
| [actions/setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0) | v7.1.0 |
| [actions/upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | v7.0.2 |
| [appleboy/scp-action](https://github.com/appleboy/scp-action/releases/tag/v1.0.0) | v1.0.0 |
| [appleboy/ssh-action](https://github.com/appleboy/ssh-action/releases/tag/v1.2.5) | v1.2.5 |
| [docker/build-push-action](https://github.com/docker/build-push-action/releases/tag/v7.4.0) | v7.4.0 |
| [docker/login-action](https://github.com/docker/login-action/releases/tag/v4.7.0) | v4.7.0 |
| [docker/metadata-action](https://github.com/docker/metadata-action/releases/tag/v6.2.0) | v6.2.0 |
| [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action/releases/tag/v4.4.1) | v4.4.1 |
| [dorny/paths-filter](https://github.com/dorny/paths-filter/releases/tag/v4.0.3) | v4.0.3 |
| [easingthemes/ssh-deploy](https://github.com/easingthemes/ssh-deploy/releases/tag/v6.0.1) | v6.0.1 |
| [pnpm/action-setup](https://github.com/pnpm/action-setup/releases/tag/v6.1.0) | v6.1.0 |
| [softprops/action-gh-release](https://github.com/softprops/action-gh-release/releases/tag/v3.0.3) | v3.0.3 |

SSH 部署步骤改用新版文档中的 `with` 输入。前端 CI 的客户端版本读取路径按其 `apps/web` 工作目录修正。工具链、包管理器及 registry 配置变更已加入工作流路径过滤。

## 未采用更高版本的原因

- 以稳定版为准：rustls 最新稳定版为 0.23.46，未采用 0.24.0-dev.2 等开发版；xterm 的开发渠道也不替代其稳定版。
- Axum 0.8.9 精确要求 `matchit =0.8.4`，因此连 0.8.6 补丁版也不能直接替换，更不能强行换成最新的 0.9.2。尝试解析 0.8.6 已得到 Cargo 的版本冲突。Axum 同时要求 tokio-tungstenite 0.29；客户端已使用 0.30，服务端的间接 0.29 必须暂留。
- `crypto-common 0.1.7` 精确要求 `generic-array =0.14.7`。单独强制升级会把已使用的 generic-array 0.14.9 降级，因此保留 Cargo 全量解析选择的 0.1.6 / 0.14.9 组合；同一依赖树的新版分支已使用 crypto-common 0.2.2。
- 前端直接使用的 react-router-dom 最新稳定版是 7.18.5，它精确依赖 react-router 7.18.5；react-router 独立包虽然已有 8.5.1，也无法在保留该 DOM 包的情况下强行替换。
- pnpm 的发布等待期会暂时过滤刚发布的版本。按本次“尽量最新”的要求安装 react-router-dom / react-router 7.18.5 后，pnpm 仅为这两个具体版本写入 `minimumReleaseAgeExclude`，其余策略保持原样。
- 其他保留在旧兼容分支的间接依赖受上游声明限制，见下表；没有用全局 overrides 或本地 fork 强行跨越上游接口边界。表格列出锁文件中的实例，包含跨平台和可选依赖，并不表示它们全部在当前平台编译。

### Rust 间接依赖的上游约束

“最新稳定版”来自本次 Cargo 刷新后的 crates.io 索引；“上游约束”来自对应发布版本的依赖元数据。除上述 crypto-common 取舍外，`cargo update --dry-run --verbose` 已无可直接更新的兼容版本。

| 间接依赖 | 保留版本 | 最新稳定版 | 上游约束 |
|---|---|---|---|
| allocator-api2 | 0.2.21 | 0.4.0 | hashbrown 0.16.1 (^0.2.9) |
| atoi | 2.0.0 | 3.1.1 | sqlx-postgres 0.9.0 (^2.0)；sqlx-sqlite 0.9.0 (^2.0) |
| base16ct | 0.2.0 | 1.0.0 | elliptic-curve 0.13.8 (^0.2)；sec1 0.7.3 (^0.2) |
| base64 | 0.22.1 | 0.23.1 | axum 0.8.9 (^0.22.1)；jsonwebtoken 11.1.0 (^0.22)；pem 3.0.6 (^0.22.0)；sqlx-core 0.9.0 (^0.22.1)；sqlx-postgres 0.9.0 (^0.22.1) |
| bitflags | 1.3.2 | 2.13.2 | portable-pty 0.9.0 (^1.3) |
| block-buffer | 0.10.4 | 0.12.1 | digest 0.10.7 (^0.10) |
| cfg_aliases | 0.1.1 | 0.2.2 | nix 0.28.0 (^0.1.1) |
| const-oid | 0.9.6 | 0.10.2 | der 0.7.10 (^0.9.2)；digest 0.10.7 (^0.9)；rsa 0.9.10 (^0.9) |
| cpufeatures | 0.2.17 | 0.3.1 | curve25519-dalek 4.1.3 (^0.2.6)；sha1 0.10.7 (^0.2)；sha2 0.10.9 (^0.2) |
| crypto-bigint | 0.5.5 | 0.7.10 | elliptic-curve 0.13.8 (^0.5) |
| crypto-common | 0.1.6 | 0.2.2 | digest 0.10.7 (^0.1.3) |
| curve25519-dalek | 4.1.3 | 5.0.0 | ed25519-dalek 2.2.0 (^4) |
| der | 0.7.10 | 0.8.3 | ecdsa 0.16.9 (^0.7)；pkcs1 0.7.5 (^0.7)；pkcs8 0.10.2 (^0.7)；sec1 0.7.3 (^0.7)；spki 0.7.3 (^0.7.2) |
| digest | 0.10.7 | 0.11.3 | curve25519-dalek 4.1.3 (^0.10)；ecdsa 0.16.9 (^0.10.7)；elliptic-curve 0.13.8 (^0.10)；hmac 0.12.1 (^0.10, ^0.10.3)；rsa 0.9.10 (^0.10.5)；sha1 0.10.7 (^0.10.7)；sha2 0.10.9 (^0.10.7)；signature 2.2.0 (^0.10.6) |
| downcast-rs | 1.2.1 | 2.0.2 | portable-pty 0.9.0 (^1.0) |
| ecdsa | 0.16.9 | 0.17.0 | p256 0.13.2 (^0.16)；p384 0.13.1 (^0.16) |
| ed25519 | 2.2.3 | 3.0.0 | ed25519-dalek 2.2.0 (>=2.2, <2.3) |
| ed25519-dalek | 2.2.0 | 3.0.0 | jsonwebtoken 11.1.0 (^2.1.1) |
| elliptic-curve | 0.13.8 | 0.14.3 | ecdsa 0.16.9 (^0.13, ^0.13.6)；p256 0.13.2 (^0.13.1)；p384 0.13.1 (^0.13)；primeorder 0.13.6 (^0.13.7) |
| ff | 0.13.1 | 0.14.0 | elliptic-curve 0.13.8 (^0.13)；group 0.13.0 (^0.13) |
| fiat-crypto | 0.2.9 | 0.3.0 | curve25519-dalek 4.1.3 (^0.2.1) |
| generic-array | 0.14.9 | 1.4.5 | block-buffer 0.10.4 (^0.14)；crypto-bigint 0.5.5 (^0.14)；crypto-common 0.1.6 (^0.14.4)；elliptic-curve 0.13.8 (^0.14.6)；sec1 0.7.3 (^0.14.7)；sqlx-mysql 0.9.0 (^0.14.4) |
| getrandom | 0.2.17 | 0.4.3 | jsonwebtoken 11.1.0 (^0.2)；rand_core 0.6.4 (^0.2)；ring 0.17.14 (^0.2.10) |
| getrandom | 0.3.4 | 0.4.3 | rand_core 0.9.5 (^0.3.0) |
| group | 0.13.0 | 0.14.0 | elliptic-curve 0.13.8 (^0.13) |
| hashbrown | 0.16.1 | 0.17.1 | hashlink 0.11.1 (^0.16)；sqlx-core 0.9.0 (^0.16.0) |
| hashlink | 0.11.1 | 0.12.2 | sqlx-core 0.9.0 (^0.11.0) |
| hkdf | 0.12.4 | 0.13.0 | elliptic-curve 0.13.8 (^0.12.1) |
| hmac | 0.12.1 | 0.13.0 | hkdf 0.12.4 (^0.12.1)；jsonwebtoken 11.1.0 (^0.12.1)；rfc6979 0.4.0 (^0.12) |
| libsqlite3-sys | 0.37.0 | 0.39.1 | sqlx-sqlite 0.9.0 (>=0.30.1, <0.38.0) |
| lock_api | 0.4.14 | 0.5.0 | futures-intrusive 0.5.0 (^0.4.1)；parking_lot 0.12.5 (^0.4.14)；spin 0.9.9 (^0.4) |
| matchit | 0.8.4 | 0.9.2 | axum 0.8.9 (=0.8.4) |
| nix | 0.28.0 | 0.31.3 | portable-pty 0.9.0 (^0.28) |
| num-bigint | 0.4.8 | 0.5.1 | simple_asn1 0.6.4 (^0.4) |
| num-bigint-dig | 0.8.6 | 0.9.1 | rsa 0.9.10 (^0.8.6) |
| p256 | 0.13.2 | 0.14.0 | jsonwebtoken 11.1.0 (^0.13.2) |
| p384 | 0.13.1 | 0.14.0 | jsonwebtoken 11.1.0 (^0.13.0) |
| parking_lot | 0.12.5 | 0.13.0 | futures-intrusive 0.5.0 (^0.12.0)；tokio 1.54.1 (^0.12.0) |
| parking_lot_core | 0.9.12 | 0.10.0 | parking_lot 0.12.5 (^0.9.12) |
| pem | 3.0.6 | 4.0.0 | jsonwebtoken 11.1.0 (^3) |
| pem-rfc7468 | 0.7.0 | 1.0.0 | der 0.7.10 (^0.7)；elliptic-curve 0.13.8 (^0.7) |
| pkcs8 | 0.10.2 | 0.11.0 | ed25519 2.2.3 (^0.10)；elliptic-curve 0.13.8 (^0.10.2)；pkcs1 0.7.5 (^0.10)；rsa 0.9.10 (^0.10.2)；sec1 0.7.3 (^0.10) |
| primeorder | 0.13.6 | 0.14.0 | p256 0.13.2 (^0.13)；p384 0.13.1 (^0.13) |
| r-efi | 5.3.0 | 7.1.0 | getrandom 0.3.4 (^5.1) |
| r-efi | 6.0.0 | 7.1.0 | getrandom 0.4.3 (^6) |
| rand | 0.8.8 | 0.10.3 | jsonwebtoken 11.1.0 (^0.8.5)；num-bigint-dig 0.8.6 (^0.8, ^0.8.3) |
| rand | 0.9.5 | 0.10.3 | tungstenite 0.29.0 (^0.9.0) |
| rand_chacha | 0.3.1 | 0.10.0 | rand 0.8.8 (^0.3.0) |
| rand_chacha | 0.9.0 | 0.10.0 | rand 0.9.5 (^0.9.0) |
| rand_core | 0.6.4 | 0.10.1 | crypto-bigint 0.5.5 (^0.6, ^0.6.4)；elliptic-curve 0.13.8 (^0.6.4)；ff 0.13.1 (^0.6)；group 0.13.0 (^0.6)；rand 0.8.8 (^0.6.0)；rand_chacha 0.3.1 (^0.6.0)；rsa 0.9.10 (^0.6, ^0.6.4)；signature 2.2.0 (^0.6.4) |
| rand_core | 0.9.5 | 0.10.1 | rand 0.9.5 (^0.9.0)；rand_chacha 0.9.0 (^0.9.0) |
| redox_syscall | 0.5.18 | 0.9.5 | parking_lot_core 0.9.12 (^0.5) |
| rfc6979 | 0.4.0 | 0.6.0 | ecdsa 0.16.9 (^0.4) |
| sec1 | 0.7.3 | 0.8.1 | elliptic-curve 0.13.8 (^0.7.1) |
| sha1 | 0.10.7 | 0.11.0 | axum 0.8.9 (^0.10)；tungstenite 0.29.0 (^0.10) |
| sha2 | 0.10.9 | 0.11.1 | ed25519-dalek 2.2.0 (^0.10)；jsonwebtoken 11.1.0 (^0.10.7)；p256 0.13.2 (^0.10)；p384 0.13.1 (^0.10)；sqlx-core 0.9.0 (^0.10.0)；sqlx-macros-core 0.9.0 (^0.10.0) |
| signature | 2.2.0 | 3.0.0 | ecdsa 0.16.9 (^2.0, <2.3)；ed25519 2.2.3 (^2)；jsonwebtoken 11.1.0 (^2.2.0)；rsa 0.9.10 (>2.0, <2.3) |
| spin | 0.9.9 | 0.12.3 | flume 0.12.0 (^0.9.8)；lazy_static 1.5.1 (^0.9.8) |
| spki | 0.7.3 | 0.8.1 | ecdsa 0.16.9 (^0.7.2)；pkcs1 0.7.5 (^0.7)；pkcs8 0.10.2 (^0.7.1)；rsa 0.9.10 (^0.7.3) |
| syn | 2.0.119 | 3.0.9 | curve25519-dalek-derive 0.1.1 (^2.0.27)；sqlx-macros 0.9.0 (^2.0.87)；sqlx-macros-core 0.9.0 (^2.0.87)；thiserror-impl 1.0.69 (^2.0.87)；tracing-attributes 0.1.31 (^2.0)；windows-implement 0.60.2 (^2.0)；windows-interface 0.59.3 (^2.0)；zerocopy-derive 0.8.63 (^2.0.46)；zeroize_derive 1.5.0 (^2) |
| thiserror | 1.0.69 | 2.0.21 | filedescriptor 0.8.3 (^1.0) |
| thiserror-impl | 1.0.69 | 2.0.21 | thiserror 1.0.69 (=1.0.69) |
| tokio-tungstenite | 0.29.0 | 0.30.0 | axum 0.8.9 (^0.29.0) |
| tungstenite | 0.29.0 | 0.30.0 | tokio-tungstenite 0.29.0 (^0.29.0) |
| webpki-roots | 0.26.11 | 1.0.11 | tokio-tungstenite 0.30.0 (^0.26.0) |
| windows-core | 0.62.2 | 0.100.0 | iana-time-zone 0.1.65 (>=0.56, <=0.62) |
| windows-implement | 0.60.2 | 0.100.0 | windows-core 0.62.2 (^0.60.2) |
| windows-interface | 0.59.3 | 0.100.0 | windows-core 0.62.2 (^0.59.3) |
| windows-link | 0.2.1 | 0.100.0 | chrono 0.4.45 (^0.2)；parking_lot_core 0.9.12 (^0.2.0)；windows-core 0.62.2 (^0.2.1)；windows-result 0.4.1 (^0.2.1)；windows-strings 0.5.1 (^0.2.1)；windows-sys 0.61.2 (^0.2.1) |
| windows-result | 0.4.1 | 0.100.0 | windows-core 0.62.2 (^0.4.1) |
| windows-strings | 0.5.1 | 0.100.0 | windows-core 0.62.2 (^0.5.1) |
| windows-sys | 0.52.0 | 0.61.2 | ring 0.17.14 (^0.52) |
| windows-targets | 0.52.6 | 0.53.5 | windows-sys 0.52.0 (^0.52.0) |
| windows_aarch64_gnullvm | 0.52.6 | 0.53.1 | windows-targets 0.52.6 (^0.52.6) |
| windows_aarch64_msvc | 0.52.6 | 0.53.1 | windows-targets 0.52.6 (^0.52.6) |
| windows_i686_gnu | 0.52.6 | 0.53.1 | windows-targets 0.52.6 (^0.52.6) |
| windows_i686_gnullvm | 0.52.6 | 0.53.1 | windows-targets 0.52.6 (^0.52.6) |
| windows_i686_msvc | 0.52.6 | 0.53.1 | windows-targets 0.52.6 (^0.52.6) |
| windows_x86_64_gnu | 0.52.6 | 0.53.1 | windows-targets 0.52.6 (^0.52.6) |
| windows_x86_64_gnullvm | 0.52.6 | 0.53.1 | windows-targets 0.52.6 (^0.52.6) |
| windows_x86_64_msvc | 0.52.6 | 0.53.1 | windows-targets 0.52.6 (^0.52.6) |
| winreg | 0.10.1 | 0.56.0 | portable-pty 0.9.0 (^0.10) |
| wit-bindgen | 0.57.1 | 0.63.0 | wasip2 1.0.4+wasi-0.2.12 (^0.57.1) |

### 前端间接依赖的上游约束

以下来自已安装依赖树、各父包的 package.json，以及 npm 官方 `/latest` 端点；不把独立包的新大版本强制注入旧 API 的消费者。

| 间接依赖 | 保留版本 | 最新稳定版 | 上游约束 |
|---|---|---|---|
| @babel/code-frame | 7.29.7 | 8.0.6 | @testing-library/dom 10.4.2 (^7.10.4) |
| @babel/helper-validator-identifier | 7.29.7 | 8.0.6 | @babel/code-frame 7.29.7 (^7.29.7) |
| @babel/runtime | 7.29.10 | 8.0.8 | @testing-library/dom 10.4.2 (^7.12.5)；@testing-library/react 16.3.3 (^7.12.5) |
| @oxc-project/types | 0.155.0 | 0.156.0 | rolldown 1.2.15 (=0.155.0) |
| ansi-regex | 5.0.1 | 6.4.0 | pretty-format 27.5.1 (^5.0.1) |
| ansi-styles | 5.2.0 | 7.0.0 | pretty-format 27.5.1 (^5.0.0) |
| aria-query | 5.3.0 | 5.3.2 | @testing-library/dom 10.4.2 (5.3.0) |
| cookie | 1.1.1 | 2.0.1 | react-router 7.18.5 (^1.0.1) |
| dom-accessibility-api | 0.5.16 | 0.7.1 | @testing-library/dom 10.4.2 (^0.5.9) |
| dom-accessibility-api | 0.6.3 | 0.7.1 | @testing-library/jest-dom 7.0.1 (^0.6.3) |
| es-module-lexer | 2.3.2 | 3.0.4 | vitest 5.0.5 (^2.3.2) |
| indent-string | 4.0.0 | 5.0.0 | redent 3.0.0 (^4.0.0) |
| js-tokens | 4.0.0 | 10.0.0 | @babel/code-frame 7.29.7 (^4.0.0) |
| mdn-data | 2.27.1 | 2.37.2 | css-tree 3.2.1 (2.27.1) |
| nanoid | 3.3.20 | 6.0.2 | postcss 8.5.32 (^3.3.20) |
| pretty-format | 27.5.1 | 30.5.1 | @testing-library/dom 10.4.2 (^27.0.2) |
| react-is | 17.0.2 | 19.3.1 | pretty-format 27.5.1 (^17.0.1) |
| react-router | 7.18.5 | 8.5.1 | react-router-dom 7.18.5 (7.18.5) |
| redent | 3.0.0 | 4.0.0 | @testing-library/jest-dom 7.0.1 (^3.0.0) |
| set-cookie-parser | 2.7.3 | 3.2.1 | react-router 7.18.5 (^2.6.0) |
| strip-indent | 3.0.0 | 4.1.1 | redent 3.0.0 (^3.0.0) |
| why-is-node-running | 3.2.1 | 3.2.3 | vitest 5.0.5 (3.2.1) |

## 验证

- Rust 1.99.1：`cargo test --workspace --locked`（客户端 36 项，服务端 112 项），包含旧 JWT 格式与历史 Argon2 哈希的兼容性验证。
- Node 26.12.1 / pnpm 12.15.0：冻结锁文件安装、前端 106 项测试及带 `/remote_claude` 部署前缀的生产构建。
- actionlint 1.7.12：四个 GitHub Actions 工作流静态校验。
- 修复配置路径测试共享修改 CONFIG_PATH 导致的并发竞态，配置读取优先级不变。
- 本机为 Windows，未执行 Docker 镜像构建、远程部署或 Linux/macOS/ARM64 原生构建；对应产物仍需由 GitHub Actions 验证。
