﻿import { KawaseBlurPass, KernelSize, Pass } from "postprocessing"
import { LinearFilter, WebGLRenderTarget } from "three"
import { SSRCompositeMaterial } from "./material/SSRCompositeMaterial"
import { ReflectionsPass } from "./ReflectionsPass"

const defaultOptions = {
	width: 2000,
	height: 1000,
	useBlur: true,
	blurKernelSize: KernelSize.SMALL,
	blurWidth: 2000,
	blurHeight: 1000,
	rayStep: 0.1,
	intensity: 1,
	power: 1,
	depthBlur: 0.1,
	enableJittering: false,
	jitter: 0.1,
	jitterSpread: 0.1,
	jitterRough: 0.1,
	roughnessFadeOut: 1,
	MAX_STEPS: 20,
	NUM_BINARY_SEARCH_STEPS: 5,
	maxDepthDifference: 3,
	maxDepth: 1,
	thickness: 10,
	ior: 1.45,
	stretchMissedRays: false,
	useMRT: true,
	useNormalMap: true,
	useRoughnessMap: true
}

export class SSRPass extends Pass {
	constructor(scene, camera, options = defaultOptions) {
		super("SSRPass")

		this.needsDepthTexture = true

		this._camera = camera
		options = { ...defaultOptions, ...options }

		this.fullscreenMaterial = new SSRCompositeMaterial()

		// returns just the calculates reflections
		this.reflectionsPass = new ReflectionsPass(scene, camera, options)

		this.reflectionsPass.setSize(options.width, options.height)

		if (options.useBlur) {
			this.fullscreenMaterial.defines.USE_BLUR = ""
			this.reflectionsPass.fullscreenMaterial.defines.USE_BLUR = ""
		}

		if (options.stretchMissedRays) {
			this.reflectionsPass.fullscreenMaterial.defines.STRETCH_MISSED_RAYS = ""
		}

		// used to smooth out reflections by blurring them (more blur the longer the ray is)
		this.kawaseBlurPass = new KawaseBlurPass()
		this.kawaseBlurPass.kernelSize = options.blurKernelSize

		const parameters = {
			minFilter: LinearFilter,
			magFilter: LinearFilter
		}

		this.kawaseBlurPassRenderTarget = new WebGLRenderTarget(options.blurWidth, options.blurHeight, parameters)
	}

	setSize(width, height) {
		this.reflectionsPass.setSize(width, height)
	}

	get reflectionUniforms() {
		return this.reflectionsPass.fullscreenMaterial.uniforms
	}

	render(renderer, inputBuffer, outputBuffer) {
		this.reflectionsPass.render(renderer, inputBuffer, this.reflectionsPass.renderTarget)

		const useBlur = "USE_BLUR" in this.fullscreenMaterial.defines

		if (useBlur) {
			renderer.setRenderTarget(this.kawaseBlurPassRenderTarget)
			this.kawaseBlurPass.render(renderer, this.reflectionsPass.renderTarget, this.kawaseBlurPassRenderTarget)
		}

		const blurredReflectionsBuffer = useBlur ? this.kawaseBlurPassRenderTarget.texture : null

		this.fullscreenMaterial.uniforms.inputBuffer.value = inputBuffer.texture
		this.fullscreenMaterial.uniforms.reflectionsBuffer.value = this.reflectionsPass.renderTarget.texture
		this.fullscreenMaterial.uniforms.blurredReflectionsBuffer.value = blurredReflectionsBuffer
		this.fullscreenMaterial.uniforms._projectionMatrix.value = this._camera.projectionMatrix

		renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
		renderer.render(this.scene, this.camera)
	}
}