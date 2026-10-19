import type { WebGLRenderer } from 'three';

/**
 * Detecta placas de vídeo fracas ou renderização por software (SwiftShader, llvmpipe...).
 * Nelas o 3D trava a página, então o site mantém a versão estática.
 * Para forçar o 3D mesmo assim (testes), abra a página com ?force3d.
 */
export function isWeakGPU(renderer: WebGLRenderer) {
  if (new URLSearchParams(location.search).has('force3d')) return false;
  if ((navigator.hardwareConcurrency || 8) <= 2) return true;
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|software|basic render/i.test(name);
}
