const {EleventyI18nPlugin} = require('@11ty/eleventy')
const Image = require('@11ty/eleventy-img')
const faviconsPlugin = require('eleventy-plugin-gen-favicons')
const rssPlugin = require('@11ty/eleventy-plugin-rss')
const sassPlugin = require('eleventy-sass')

const markdownIt = require('markdown-it')
const anchor = require('markdown-it-anchor')
const mdIterator = require('markdown-it-for-inline')

const path = require('node:path')

const outputDir = 'build'

module.exports = config => {
	/** @todo concat if multiple scripts */
	config.addPassthroughCopy('src/js/*.js')
	config.addPassthroughCopy('src/font/*.ttf')
	config.addPassthroughCopy('CNAME')

	/** @note {defaultLanguage: any valid BCP 47 tag} */
	config.addPlugin(EleventyI18nPlugin, {defaultLanguage: 'en-US'})
	config.addPlugin(faviconsPlugin, {outputDir, manifestData: {name: 'Minifyre'}})
	config.addPlugin(rssPlugin)
	config.addPlugin(sassPlugin, [{sass: {style: 'compressed', sourceMap: true}}])

	/** @note _prefix denotes that these are custom filters that should hopefully not interfere with others if newer filters are added with similar names */
	/** @note this could cause issues if a person's hyphenated last name is ever used as a page name. */
	config.addFilter('_kebab2titleCase', function (string) {
		return string
			.split('-')
			.map(
				([letter, ...letters]) =>
					letter.toLocaleUpperCase(this.page.lang) + letters.join('')
			)
			.join(' ')
	})

	config.addFilter('_post2permalink', ([lang, word4blog, date, slug]) => {
		const [yyyy, mm, dd] = date.toISOString().split('T')[0].split('-')
		return ['', lang, word4blog, yyyy, mm, dd, slug, 'index.html'].join('/')
	})

	config.addFilter('_getLangPosts', (collection, lang) =>
		collection.filter(post => post.data.lang == lang)
	)

	config.addFilter('_getShareImgUrl', (absoluteUrl, imgSize = 0) => {
		if (absoluteUrl.match(/undefined$/) || !imgSize) return ''

		const [ext, ...path] = absoluteUrl.split('.').reverse()
		/** @note necessary because [`.jpg`s become `.jpeg`s...](https://github.com/11ty/eleventy-img/issues/64) */
		const fixedExt = ext === 'jpg' ? 'jpeg' : ext

		return `${path.reverse().join('.')}-${imgSize}.${fixedExt}`
	})

	config.addNunjucksShortcode(
		'finePrint',
		/** @note the slice is to remove redundant paragraph tags */
		content =>
			`<p class="fine-print">${markdownIt({html: true}).render(content).slice(3, -5)}</p>`
	)

	config.addShortcode(
		'image',
		async (filePath, alt, sizes = '(min-width: 800px) 50vw, 100vw') => {
			const metadata = await Image(path.join(config.dir.input, filePath), {
				widths: [400, 800, 1600],
				formats: filePath.match(/png$/) ? ['png'] : ['avif', 'svg', 'jpg'],
				outputDir: './build/img/',
				urlPath: '/img/',
				// svgCompressionSize: "br",

				filenameFormat: function (_id, src, width, format, _options) {
					const extension = path.extname(src)
					const name = path.basename(src, extension)

					return `${name}-${width}.${format}`
				},
			})

			return Image.generateHTML(metadata, {alt, sizes, loading: 'eager', decoding: 'async'})
		}
	)

	config.setLayoutResolution(false)

	const markdownLibrary = markdownIt({html: true, breaks: true, linkify: true})
		.use(anchor, {permalink: anchor.permalink.headerLink()})
		.use(mdIterator, 'url_new_win', 'link_open', (tokens, idx) => {
			const [_attrName, href] = tokens[idx].attrs.find(attr => attr[0] === 'href')
			if (!href || href.includes('minify.re') || href.match(/^[\/#]/)) return

			tokens[idx].attrPush(['target', '_blank'])
		})

	config.setLibrary('md', markdownLibrary)

	return {
		dir: {input: 'src', output: outputDir},
		markdownTemplateEngine: 'njk',
	}
}
