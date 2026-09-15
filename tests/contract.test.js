import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

// Strips `//` and `/* */` comments so the forbidden-pattern checks below
// match real code, not doc comments that mention the anti-pattern they
// document this package as avoiding (e.g. "does not require vite-svg-loader").
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir, onFile) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, onFile);
    else onFile(p);
  }
}

describe("exports map", () => {
  it("every export target resolves to a file inside the package", () => {
    for (const [specifier, target] of Object.entries(pkg.exports)) {
      expect(target.startsWith("./")).toBe(true);
      expect(target).not.toMatch(/^\/|^[A-Za-z]:\\/);
      expect(target.split("/")).not.toContain("..");
      expect(existsSync(path.join(root, target)), `${specifier} -> ${target} missing`).toBe(true);
    }
  });

  it("core entry stays free of Vue Router imports; navigation entry requires it", () => {
    const coreFiles = [];
    walk(path.join(root, "src", "components"), (p) => {
      if (!p.includes(`${path.sep}navigation${path.sep}`)) coreFiles.push(p);
    });
    for (const file of coreFiles) {
      expect(read(path.relative(root, file))).not.toMatch(/from ["']vue-router["']/);
    }

    const navFiles = [];
    walk(path.join(root, "src", "components", "navigation"), (p) => navFiles.push(p));
    expect(navFiles.length).toBeGreaterThan(0);
    for (const file of navFiles) {
      expect(read(path.relative(root, file))).toMatch(/from ["']vue-router["']/);
    }
  });
});

describe("peer dependency contract", () => {
  it("declares vue/buefy/vue-router/@iam3xtr/ui as peers, not hard dependencies", () => {
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toMatchObject({
      vue: expect.any(String),
      buefy: expect.any(String),
      "vue-router": expect.any(String),
      "@iam3xtr/ui": expect.any(String),
    });
  });

  it("marks vue-router optional (only ./navigation needs it)", () => {
    expect(pkg.peerDependenciesMeta["vue-router"].optional).toBe(true);
  });

  it("never bundles a second Vue, router or Pinia store", () => {
    walk(path.join(root, "src"), (file) => {
      if (!/\.(js|vue)$/.test(file)) return;
      const content = stripComments(readFileSync(file, "utf8"));
      expect(content).not.toMatch(/createApp\s*\(/);
      expect(content).not.toMatch(/\.use\s*\(/);
      expect(content).not.toMatch(/from ["']pinia["']/);
      expect(content).not.toMatch(/createRouter\s*\(/);
    });
  });
});

describe("no kit-specific aliasing or fixtures leak into the package", () => {
  it("ships no @/ alias, vite-svg-loader import, fixture data, or product route names", () => {
    walk(path.join(root, "src"), (file) => {
      if (!/\.(js|vue)$/.test(file)) return;
      const content = stripComments(readFileSync(file, "utf8"));
      expect(content).not.toMatch(/@\/(assets|components|stores)/);
      expect(content).not.toMatch(/from ["'][^"']*vite-svg-loader/);
      expect(content).not.toMatch(/from ["']\.\.\/\.\.\/stores/);
      // No hardcoded consuming-application route name (the kit's own
      // "workspace-plans" route this was ported away from).
      expect(content).not.toMatch(/workspace-plans/);
    });
  });

  it("ships no fixtures, env files, or build secrets", () => {
    const forbidden = /\.env(\..*)?$|fixture|secret|\.pem$|\.key$/i;
    walk(path.join(root, "src"), (file) => {
      expect(forbidden.test(path.basename(file))).toBe(false);
    });
  });

  it("npm pack ships only the declared files, no tests/node_modules", () => {
    const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    const jsonStart = out.indexOf("[");
    const [{ files }] = JSON.parse(out.slice(jsonStart));
    const paths = files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining(["package.json", "README.md", "LICENSE", "src/index.js", "src/navigation.js"]),
    );
    for (const p of paths) {
      expect(p.startsWith("tests/")).toBe(false);
      expect(p.startsWith("node_modules/")).toBe(false);
      expect(p).not.toMatch(/vitest\.config/);
    }
  });
});
