/* Ready-made block designs for the EDS block builder. Each one is a normal spec, so the builder
   produces the model, filter, delivered HTML, JavaScript and CSS from it and you can change anything. */
(function (root) {
  'use strict';
  var S = root.KJBB.shortcuts;
  var F = function (type, label, name, extra) { return Object.assign({ type: type, label: label, name: name }, extra || {}); };
  var concat = function () { return Array.prototype.concat.apply([], arguments); };
  var opt = function (list) { return list.map(function (p) { return { name: p[0], value: p[1] }; }); };

  var P = [
    { id: 'hero', group: 'Boilerplate', existing: true, title: 'Hero', blurb: 'Large image with a heading and text over it.', spec: {
      name: 'Hero', shape: 'simple', pattern: 'plain', variants: [],
      fields: concat(S.image('Image', 'image'), [F('richtext', 'Text', 'text')]) } },
    { id: 'cards', group: 'Boilerplate', existing: true, title: 'Cards', blurb: 'A grid of cards, each with an image and text.', spec: {
      name: 'Cards', shape: 'container', pattern: 'list', itemName: 'Card', itemId: 'card', variants: [], fields: [],
      itemFields: concat(S.image('Image', 'image'), [F('richtext', 'Text', 'text')]) } },
    { id: 'columns', group: 'Boilerplate', existing: true, title: 'Columns', blurb: 'Side-by-side columns. Has no content model of its own.', spec: {
      name: 'Columns', shape: 'columns', pattern: 'plain', variants: [], fields: [], itemFields: [] } },
    { id: 'fragment', group: 'Boilerplate', existing: true, title: 'Fragment', blurb: 'Pulls in content from another page.', spec: {
      name: 'Fragment', shape: 'simple', pattern: 'plain', variants: [],
      fields: [F('aem-content', 'Reference', 'reference', { description: 'The page whose content is shown here.' })] } },

    { id: 'accordion', group: 'Block Collection', title: 'Accordion', blurb: 'Expandable items, each with a label and a body.', spec: {
      name: 'Accordion', shape: 'container', pattern: 'accordion', itemName: 'Accordion Item', variants: [], fields: [],
      itemFields: [F('text', 'Label', 'summary'), F('richtext', 'Body', 'text')] } },
    { id: 'tabs', group: 'Block Collection', title: 'Tabs', blurb: 'Labelled panels, one visible at a time.', spec: {
      name: 'Tabs', shape: 'container', pattern: 'tabs', itemName: 'Tab', variants: [], fields: [],
      itemFields: [F('text', 'Tab label', 'title'), F('richtext', 'Tab content', 'content')] } },
    { id: 'carousel', group: 'Block Collection', title: 'Carousel', blurb: 'Slides you scroll or step through.', spec: {
      name: 'Carousel', shape: 'container', pattern: 'carousel', itemName: 'Slide', variants: [], fields: [],
      itemFields: concat(S.image('Image', 'image'), [F('richtext', 'Text', 'text')]) } },
    { id: 'quote', group: 'Block Collection', title: 'Quote', blurb: 'A pull quote with an attribution.', spec: {
      name: 'Quote', shape: 'simple', pattern: 'plain', variants: [],
      fields: [F('richtext', 'Quote', 'quote'), F('text', 'Attribution', 'author')] } },
    { id: 'video', group: 'Block Collection', title: 'Video', blurb: 'A video link with an optional poster image.', spec: {
      name: 'Video', shape: 'simple', pattern: 'plain', variants: [],
      fields: concat(S.image('Poster image', 'image'), [F('aem-content', 'Video', 'video', { description: 'Link to the video file.' })]) } },
    { id: 'embed', group: 'Block Collection', title: 'Embed', blurb: 'Embeds a social post or other external content.', spec: {
      name: 'Embed', shape: 'simple', pattern: 'plain', variants: [],
      fields: concat(S.image('Placeholder image', 'image'), [F('aem-content', 'Embed URL', 'embed')]) } },
    { id: 'table', group: 'Block Collection', title: 'Table', blurb: 'A data table with style options.', spec: {
      name: 'Table', shape: 'simple', pattern: 'plain',
      variants: opt([['Striped', 'striped'], ['Bordered', 'bordered'], ['No header', 'no-header']]),
      fields: [F('richtext', 'Table', 'table')] } },
    { id: 'breadcrumbs', group: 'Block Collection', title: 'Breadcrumbs', blurb: 'Shows where the page sits. Nothing to author.', spec: {
      name: 'Breadcrumbs', shape: 'simple', pattern: 'plain', variants: [], fields: [], noFields: true } },

    { id: 'teaser', group: 'Common patterns', title: 'Teaser', blurb: 'Image plus heading, text and a button. Shows element grouping.', spec: {
      name: 'Teaser', shape: 'simple', pattern: 'plain',
      variants: opt([['Dark', 'dark'], ['Image on the left', 'image-left'], ['Full width', 'full-width']]),
      fields: concat(S.image('Image', 'media_image'),
        S.heading('Title', 'content_title', 'h2'),
        [F('richtext', 'Text', 'content_text')],
        S.link('Button', 'content_cta')) } },
    { id: 'features', group: 'Common patterns', title: 'Feature list', blurb: 'Icon, heading, text and link for each feature.', spec: {
      name: 'Feature List', shape: 'container', pattern: 'list', itemName: 'Feature',
      variants: opt([['2 columns', 'cols-2'], ['3 columns', 'cols-3'], ['4 columns', 'cols-4']]), fields: [],
      itemFields: concat(S.image('Icon', 'image'), S.heading('Title', 'title', 'h3'), [F('richtext', 'Text', 'text')], S.link('Link', 'link')) } },
    { id: 'stats', group: 'Common patterns', title: 'Stats', blurb: 'Big numbers with labels.', spec: {
      name: 'Stats', shape: 'container', pattern: 'list', itemName: 'Stat', variants: [], fields: [],
      itemFields: [F('text', 'Value', 'value', { description: 'For example 98% or 12k+' }), F('text', 'Label', 'label'), F('textarea', 'Note', 'note')] } },
    { id: 'logo-wall', group: 'Common patterns', title: 'Logo wall', blurb: 'A grid of partner or client logos.', spec: {
      name: 'Logo Wall', shape: 'container', pattern: 'list', itemName: 'Logo', variants: [], fields: [],
      itemFields: concat(S.image('Logo', 'image'), S.link('Link', 'link')) } },
    { id: 'testimonials', group: 'Common patterns', title: 'Testimonials', blurb: 'Quotes with name, role and photo.', spec: {
      name: 'Testimonials', shape: 'container', pattern: 'list', itemName: 'Testimonial', variants: [], fields: [],
      itemFields: concat([F('richtext', 'Quote', 'quote'), F('text', 'Name', 'author'), F('text', 'Role', 'role')], S.image('Photo', 'image')) } },
    { id: 'faq', group: 'Common patterns', title: 'FAQ', blurb: 'Questions and answers, with FAQPage structured data.', spec: {
      name: 'FAQ', shape: 'container', pattern: 'faq', itemName: 'FAQ Item', variants: [], fields: [],
      itemFields: [F('text', 'Question', 'question'), F('richtext', 'Answer', 'answer')] } },
    { id: 'notice', group: 'Common patterns', title: 'Notice banner', blurb: 'A message with an optional link. Shows conditional fields.', spec: {
      name: 'Notice', shape: 'simple', pattern: 'plain',
      variants: opt([['Info', 'info'], ['Warning', 'warning'], ['Success', 'success']]),
      fields: [F('richtext', 'Message', 'message'), F('boolean', 'Add a link', 'showLink'),
        F('aem-content', 'Link', 'link', { condition: { field: 'showLink', op: '===', value: 'true' } }),
        F('text', 'Link text', 'linkText', { condition: { field: 'showLink', op: '===', value: 'true' } })] } },
    { id: 'config', group: 'Common patterns', title: 'Settings (key-value)', blurb: 'Name and value rows for configuration.', spec: {
      name: 'Settings', shape: 'keyvalue', pattern: 'plain', variants: [],
      fields: [F('text', 'API URL', 'apiUrl', { valueFormat: 'url' }), F('number', 'Items to show', 'limit', { value: '10', numberMin: '1', numberMax: '50' }),
        F('select', 'Mode', 'mode', { value: 'live', options: opt([['Live', 'live'], ['Preview', 'preview']]) }), F('boolean', 'Enabled', 'enabled', { value: 'true' })] } }
  ];

  var blank = { name: 'My Block', shape: 'simple', pattern: 'plain', variants: [], fields: [], itemFields: [] };
  var api = { list: P, blank: blank, get: function (id) { return P.filter(function (p) { return p.id === id; })[0]; } };
  root.KJBBPresets = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
