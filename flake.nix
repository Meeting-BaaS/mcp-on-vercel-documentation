{
  description = "meeting-baas-mcp-docs — Meeting BaaS MCP documentation server (pnpm, tsc)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" ];
      forAll = nixpkgs.lib.genAttrs systems;
      pkgsFor = s: nixpkgs.legacyPackages.${s};
    in {
      # Standalone pnpm package. `pnpm build` is `tsc || true` → dist/server.js
      # (hermetic). The wrapper runs the compiled entry; secrets/PORT come from
      # the systemd unit's EnvironmentFile/environment.
      packages = forAll (s:
        let pkgs = pkgsFor s; in {
          default = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "mcp-on-vercel-documentation";
            version = "0.1.0";
            src = ./.;
            nativeBuildInputs = [ pkgs.nodejs_20 pkgs.pnpm_8.configHook pkgs.makeWrapper ];
            pnpmDeps = pkgs.pnpm_8.fetchDeps {
              inherit (finalAttrs) pname version src;
              fetcherVersion = 2;
              hash = nixpkgs.lib.fakeHash;
            };
            env = { CI = "true"; };
            buildPhase = ''
              runHook preBuild
              pnpm build
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              dir=$out/share/mcp-on-vercel-documentation
              mkdir -p "$dir"
              cp -a . "$dir"/
              find "$dir" -xtype l -delete
              makeWrapper ${pkgs.nodejs_20}/bin/node $out/bin/mcp-on-vercel-documentation \
                --chdir "$dir" \
                --add-flags "-r dotenv/config $dir/dist/server.js"
              runHook postInstall
            '';
          });
        });
      overlays.default = final: prev: {
        mcp-on-vercel-documentation = self.packages.${final.system}.default;
      };
    };
}
