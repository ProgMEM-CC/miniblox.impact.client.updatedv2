// PLAYER ESP (created by me :D)
	addModification(')&&(p.mesh.visible=this.shouldRenderEntity(p))', `
  if (p && p.id != player.id) {
    function hslToRgb(h, s, l) {
      let r, g, b;
      if(s === 0){ r = g = b = l; }
      else {
        const hue2rgb = (p, q, t) => {
          if(t < 0) t += 1;
          if(t > 1) t -= 1;
          if(t < 1/6) return p + (q - p) * 6 * t;
          if(t < 1/2) return q;
          if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const pp = 2 * l - q;
        r = hue2rgb(pp, q, h + 1/3);
        g = hue2rgb(pp, q, h);
        b = hue2rgb(pp, q, h - 1/3);
      }
      return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
      };
    }

    function applyOutlineGlow(mesh, colorHex) {
      if (!mesh || !mesh.material) return;
      if (!mesh.userData.outlineClone) {
        const outlineMaterial = mesh.material.clone();
        outlineMaterial.color.setHex(0x000000);
        outlineMaterial.emissive.setHex(colorHex);
        outlineMaterial.emissiveIntensity = 1;
        outlineMaterial.transparent = true;
        outlineMaterial.opacity = 0.7;
        outlineMaterial.depthTest = false;

        const outline = mesh.clone();
        outline.material = outlineMaterial;
        outline.scale.multiplyScalar(1.05);
        outline.renderOrder = mesh.renderOrder + 1;

        mesh.add(outline);
        mesh.userData.outlineClone = outline;
      } else {
        mesh.userData.outlineClone.material.emissive.setHex(colorHex);
      }
    }

    if (enabledModules["Player ESP"]) {
      const time = Date.now() / 5000;
      const hue = time % 1;
      const rgb = hslToRgb(hue, 1, 0.5);
      const colorHex = (rgb.r << 16) + (rgb.g << 8) + rgb.b;

      if (p.mesh.meshes) {
        for (const key in p.mesh.meshes) {
          const mesh = p.mesh.meshes[key];
          if (!mesh?.material) continue;
          mesh.material.depthTest = false;
          mesh.renderOrder = 3;
          mesh.material.color.setHex(colorHex);
          mesh.material.emissive.setHex(colorHex);
          mesh.material.emissiveIntensity = 0.8;
          applyOutlineGlow(mesh, colorHex);
        }
      }

      if (p.mesh.armorMesh) {
        for (const key in p.mesh.armorMesh) {
          const mesh = p.mesh.armorMesh[key];
          if (!mesh?.material) continue;
          mesh.material.depthTest = false;
          mesh.renderOrder = 4;
          mesh.material.color.setHex(colorHex);
          mesh.material.emissive.setHex(colorHex);
          mesh.material.emissiveIntensity = 0.8;
          applyOutlineGlow(mesh, colorHex);
        }
      }

      if (p.mesh.capeMesh && p.mesh.capeMesh.children.length > 0) {
        const cape = p.mesh.capeMesh.children[0];
        if (cape.material) {
          cape.material.depthTest = false;
          cape.renderOrder = 5;
          cape.material.color.setHex(colorHex);
          cape.material.emissive.setHex(colorHex);
          cape.material.emissiveIntensity = 0.8;
          applyOutlineGlow(cape, colorHex);
        }
      }

      if (p.mesh.hatMesh && p.mesh.hatMesh.children.length > 0) {
        for (const mesh of p.mesh.hatMesh.children[0].children) {
          if (!mesh.material) continue;
          mesh.material.depthTest = false;
          mesh.renderOrder = 4;
          mesh.material.color.setHex(colorHex);
          mesh.material.emissive.setHex(colorHex);
          mesh.material.emissiveIntensity = 0.8;
          applyOutlineGlow(mesh, colorHex);
        }
      }
    } else {
      if (p.mesh.meshes) {
        for (const key in p.mesh.meshes) {
          const mesh = p.mesh.meshes[key];
          if (!mesh?.material) continue;
          mesh.material.depthTest = true;
          mesh.renderOrder = 0;
          mesh.material.color.setHex(0xffffff);
          mesh.material.emissive.setHex(0x000000);
          mesh.material.emissiveIntensity = 0;
          if (mesh.userData.outlineClone) {
            mesh.remove(mesh.userData.outlineClone);
            mesh.userData.outlineClone = null;
          }
        }
      }

      if (p.mesh.armorMesh) {
        for (const key in p.mesh.armorMesh) {
          const mesh = p.mesh.armorMesh[key];
          if (!mesh?.material) continue;
          mesh.material.depthTest = true;
          mesh.renderOrder = 0;
          mesh.material.color.setHex(0xffffff);
          mesh.material.emissive.setHex(0x000000);
          mesh.material.emissiveIntensity = 0;
          if (mesh.userData.outlineClone) {
            mesh.remove(mesh.userData.outlineClone);
            mesh.userData.outlineClone = null;
          }
        }
      }

      if (p.mesh.capeMesh && p.mesh.capeMesh.children.length > 0) {
        const cape = p.mesh.capeMesh.children[0];
        if (cape.material) {
          cape.material.depthTest = true;
          cape.renderOrder = 0;
          cape.material.color.setHex(0xffffff);
          cape.material.emissive.setHex(0x000000);
          cape.material.emissiveIntensity = 0;
        }
        if (cape.userData.outlineClone) {
          cape.remove(cape.userData.outlineClone);
          cape.userData.outlineClone = null;
        }
      }

      if (p.mesh.hatMesh && p.mesh.hatMesh.children.length > 0) {
        for (const mesh of p.mesh.hatMesh.children[0].children) {
          if (!mesh.material) continue;
          mesh.material.depthTest = true;
          mesh.renderOrder = 0;
          mesh.material.color.setHex(0xffffff);
          mesh.material.emissive.setHex(0x000000);
          mesh.material.emissiveIntensity = 0;
          if (mesh.userData.outlineClone) {
            mesh.remove(mesh.userData.outlineClone);
            mesh.userData.outlineClone = null;
          }
        }
      }
    }
  }
`);
