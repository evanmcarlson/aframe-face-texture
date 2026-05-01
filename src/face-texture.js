// face-texture.js
let pipelineInstalled = false
let sharedCameraTex = null

function getSharedCameraTexture() {
  if (!sharedCameraTex) {
    sharedCameraTex = new THREE.Texture()
    // Optional but often helpful:
    sharedCameraTex.flipY = false
    sharedCameraTex.minFilter = THREE.LinearFilter
    sharedCameraTex.magFilter = THREE.LinearFilter
    sharedCameraTex.generateMipmaps = false
  }
  return sharedCameraTex
}

function ensureCameraFeedPipeline(sceneEl) {
  if (pipelineInstalled) return
  pipelineInstalled = true

  const onxrloaded = () => {
    window.XR8.addCameraPipelineModule({
      name: 'cameraFeedPipeline_shared',  // ✅ unique name, installed once
      onUpdate: (processCpuResult) => {
        const result = processCpuResult?.processCpuResult
        const cameraFeedTexture = result?.facecontroller?.cameraFeedTexture
        if (!cameraFeedTexture) return

        const tex = getSharedCameraTexture()
        const {renderer} = sceneEl
        if (!renderer) return

        const texProps = renderer.properties.get(tex)
        texProps.__webglTexture = cameraFeedTexture

        // Depending on three version, this can help force refresh:
        tex.needsUpdate = true
      },
    })
  }

  window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded, {once: true})
}

const faceTextureComponent = {
  init() {
    const cameraTex = getSharedCameraTexture()
    ensureCameraFeedPipeline(this.el.sceneEl)

    // Each instance can share the same map, but have its own material object
    const materialGltf = new THREE.MeshBasicMaterial({
      map: cameraTex,
      side: THREE.DoubleSide,
    })

    let faceGltf = null

    this.el.addEventListener('model-loaded', () => {
      faceGltf = this.el.getObject3D('mesh')
      if (!faceGltf) return

      faceGltf.traverse((node) => {
        // Replace only mesh materials (safer than your current condition)
        if (node.isMesh) {
          node.material = materialGltf
        }
      })
    })

    const show = (event) => {
      if (!faceGltf) return

      const {uvsInCameraFrame, vertices: vtx, normals: nrm} = event.detail

      // NOTE: adjust this selection if your glb structure differs
      const mesh = faceGltf.children?.[0]
      const geom = mesh?.geometry
      if (!geom) return

      // positions
      const vertices = new Float32Array(vtx.length * 3)
      for (let i = 0; i < vtx.length; i++) {
        vertices[i * 3] = vtx[i].x
        vertices[i * 3 + 1] = vtx[i].y
        vertices[i * 3 + 2] = vtx[i].z
      }
      geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      geom.attributes.position.needsUpdate = true

      // uvs
      const uvs = new Float32Array(uvsInCameraFrame.length * 2)
      for (let i = 0; i < uvsInCameraFrame.length; i++) {
        uvs[i * 2] = uvsInCameraFrame[i].u
        uvs[i * 2 + 1] = uvsInCameraFrame[i].v
      }
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      geom.attributes.uv.needsUpdate = true

      // normals
      const normals = geom.attributes.normal
      if (normals && normals.count === nrm.length) {
        for (let i = 0; i < nrm.length; i++) {
          normals.array[i * 3] = nrm[i].x
          normals.array[i * 3 + 1] = nrm[i].y
          normals.array[i * 3 + 2] = nrm[i].z
        }
        normals.needsUpdate = true
      }
    }

    this.el.sceneEl.addEventListener('xrfacefound', show)
    this.el.sceneEl.addEventListener('xrfaceupdated', show)
  },
}

export {faceTextureComponent}
