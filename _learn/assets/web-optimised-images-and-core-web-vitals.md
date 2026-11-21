---
title: "Web-optimised images and Core Web Vitals"
description: "How images drive Largest Contentful Paint and layout shift, and how srcset, modern formats, dimensions and loading priority work with AEM's delivery options."
track: assets
level: 4
order: 22
minutes: 9
outcome: "By the end you can write correct responsive image markup for a hero and a card, and say what the platform does for you and what your component must do."
prereq: "Delivering assets: the options at a glance (lesson 19)."
terms:
  - { t: "LCP (Largest Contentful Paint)", d: "The time until the biggest visible element, very often the hero image, finishes rendering; 2.5 seconds or less is rated good." }
  - { t: "CLS (Cumulative Layout Shift)", d: "A measure of how much content jumps as the page loads, often caused by images without reserved space." }
  - { t: "`srcset` and `sizes`", d: "HTML attributes that list the available image widths and tell the browser how wide the image will be displayed, so it can pick one." }
  - { t: "WebP and AVIF", d: "Modern image formats that are usually smaller than JPEG or PNG at similar quality." }
  - { t: "`loading` and `fetchpriority`", d: "Attributes that control whether an image is deferred (`lazy`) or fetched early." }
mistake: "Lazy-loading the hero image because the component does it by default. The browser then discovers the most important image late, and LCP gets worse."
try_it:
  - "Open the image optimiser at /tools/image-optimiser/ and convert one large photo to WebP at about 80 quality; note the before and after size."
  - "Take its `srcset` snippet and set `sizes` for a hero that is full width on mobile and 1200 pixels on desktop."
  - "Add `width` and `height` attributes that match the image's aspect ratio."
  - "Mark the hero as eager and one card image below the fold as lazy, then explain why in one sentence each."
quiz:
  - q: "Why is lazy-loading the hero image usually a mistake?"
    options:
      - "Lazy loading is not supported in browsers"
      - "It makes the file larger"
      - "It forces the image to use a worse format"
      - "The browser starts fetching it late, which delays LCP"
    answer: 3
    why: "Lazy loading defers the fetch until the image is near the viewport, which adds delay for the very element LCP measures. It does not change file size or format."
  - q: "A card image shows at one third of the page width on desktop but its `sizes` says `100vw`. What happens?"
    options:
      - "The browser may download a larger image than needed"
      - "The image is cropped automatically"
      - "The page fails validation and shows nothing"
      - "The CDN corrects it for you"
    answer: 0
    why: "The browser trusts `sizes` to choose from `srcset`. Saying 100vw makes it pick too large a file for a small slot. Nothing validates or corrects it."
  - q: "You switch on web-optimised delivery in the Image component. Which problem is still yours to solve?"
    options:
      - "Producing WebP for supporting browsers"
      - "Choosing which hero image is eager and carries a high priority"
      - "Resizing images to common widths"
      - "Compressing the masters in the DAM"
    answer: 1
    why: "The platform handles format and sizes, but whether an image is prioritised is a markup decision in your component. Uploading good masters, not compressing them, is the DAM advice."
  - q: "Which statement is NOT true?"
    options:
      - "Missing width and height can cause layout shift"
      - "AVIF may beat WebP on photos where the browser supports it"
      - "A CSS background image is discovered as early as an img tag in the HTML"
      - "Two hidden hero images can make the browser fetch the wrong one"
    answer: 2
    why: "Browsers discover images in HTML markup early, but images referenced only from CSS are found later, which is why a hero should not be a CSS background. The other three statements are true."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media, web-optimised delivery and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "markup rules, governance and how to measure" }
  - { title: "Image optimiser", url: "/tools/image-optimiser/", why: "resize, convert and copy a srcset snippet" }
  - { title: "Performance and Core Web Vitals on AEM", url: "/learn/aem/performance-core-web-vitals/", why: "the wider performance picture" }
  - { title: "Keep Lighthouse at 100 on Edge Delivery Services", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "how EDS handles the LCP image" }
---
## The problem: the picture is the slowest thing

On most content pages the largest thing a visitor sees is an image. A 4000-pixel hero sent to a 390-pixel phone wastes seconds. That one file often decides whether a page passes **Largest Contentful Paint**, the time until the main element appears. Google rates 2.5 seconds or less, at the 75th percentile of real visits, as good.

Images also cause **layout shift**. If the browser does not know an image's size, it reserves nothing, then pushes the text down when the file arrives.

## Four jobs, two owners

Optimising an image is four separate jobs:

| Job | Question | Who usually does it |
|---|---|---|
| Size | Is it close to the displayed size, per screen? | Delivery option and `srcset` |
| Format | WebP or AVIF where supported? | Delivery option |
| Compression | Is quality sensible? | Delivery option or preset |
| Priority | Is the hero fetched first and the rest deferred? | Your component markup |

The platform does the first three when you use it well. The fourth is yours. A delivery service cannot know which image on your page matters most.

## Responsive images in markup

`srcset` lists the available widths. `sizes` tells the browser how wide the image will be shown, so it can choose before the layout is calculated. Getting `sizes` wrong is the usual reason a phone downloads the desktop file.

```html
<img src="hero-1200.webp"
     srcset="hero-480.webp 480w, hero-960.webp 960w, hero-1440.webp 1440w"
     sizes="(min-width: 1200px) 1200px, 100vw"
     width="1440" height="810"
     alt="Engineers reviewing a site plan on a tablet"
     fetchpriority="high">
```

A card in a three-column grid should say something like `(min-width: 1024px) 33vw, 100vw`. Writing `100vw` there is the most common error. The `width` and `height` attributes reserve space, so the page does not jump. Every image should have them, or an `aspect-ratio` in CSS.

## Eager for the hero, lazy for the rest

- **Hero (the LCP image): do not lazy-load it.** Put it in the HTML as an `img`, not built by script and not a CSS background, so the browser finds it at once.
- **`fetchpriority="high"`: use on one image, carefully.** This is guidance for traditional pages. Edge Delivery Services already loads the first section's image first, and aem.live advises measuring before adding priority hints there.
- **Below the fold: lazy.** Cards, galleries and footers can wait.
- **One hero, not two.** Use `<picture>` or smart crop rather than hiding a second image with CSS, which can make the browser fetch the wrong one.

## What AEM gives you, and what you must do

With the Core Image component, web-optimised delivery serves WebP, and the **Widths** setting generates a `srcset`. Adobe says that on average the files are about 25% smaller. Lazy loading is on by default in Image v3, so a hero needs a policy or component that turns it off. Dynamic Media with Smart Imaging adds automatic AVIF where your tier allows it. On Edge Delivery Services, `createOptimizedPicture` builds a `<picture>` with WebP sources and lazy loading unless you mark the image eager.

None of these touches images committed to your code, such as CSS backgrounds. Optimise those before you commit, for example with the [image optimiser tool](/tools/image-optimiser/) in your browser. Performance in general is covered in [Performance and Core Web Vitals on AEM](/learn/aem/performance-core-web-vitals/).

<details markdown="1">
<summary>Predict first, then reveal: you upload a pre-shrunk 900 pixel master. What goes wrong?</summary>

Every size is made from the master, and most services do not upscale. A 1920-pixel slot is then filled with a 900-pixel image, so the hero looks soft on large screens. Upload good masters and let delivery shrink them. Keep a 2048-pixel rendition available if you use web-optimised delivery, since it uses renditions up to that size.

</details>
