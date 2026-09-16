"""Render every Hebrew landing page from one template and a data-only catalog."""
from html import escape
import json
from pathlib import Path
import re
from string import Template

ROOT = Path(__file__).resolve().parents[1]
CONTENT_PATH = ROOT / 'tools/landing-pages.json'
TEMPLATE_PATH = ROOT / 'tools/templates/landing-page.html'
PAGES = json.loads(CONTENT_PATH.read_text(encoding='utf-8'))


def e(value):
    return escape(str(value), quote=True)


def lines(values):
    return '<br>'.join(e(value) for value in values)


def heading(values):
    return f'{e(values[0])}<br><span>{e(values[1])}</span>'


def load_templates(source=None):
    """Named components live together in the sole authored HTML template."""
    if source is None:
        source = TEMPLATE_PATH.read_text(encoding='utf-8')
    components = re.findall(r'<!-- component: ([\w-]+) -->\s*([\s\S]*?)\s*<!-- /component -->', source)
    if not components or len({name for name, _ in components}) != len(components):
        raise ValueError('Landing template components must have unique names')
    return {name: Template(body) for name, body in components}


def render(page, pages=PAGES, templates=None):
    templates = load_templates() if templates is None else templates

    def part(name, **values):
        return templates[name].substitute(values)

    def svg(name):
        if not name.startswith('icon_'):
            raise ValueError('Unknown icon component')
        return part(name)

    slug, title = page['slug'], page['title']
    if page['style'] not in {'vr', 'service'}:
        raise ValueError(f'Unknown landing-page style: {page["style"]}')
    service = page['style'] == 'service'
    url = f'https://redcrowninteractive.com/he/{slug}/'
    stage = page['stage']
    if stage['kind'] == 'model':
        hero_stage = part('model-stage', stage_class=' service-stage' if service else '',
            **{key: e(stage[key]) for key in ('src', 'alt', 'orbit', 'exposure', 'label', 'fallback_image', 'fallback_alt', 'fallback_caption', 'loading_text')})
    elif stage['kind'] == 'image':
        roadmap_items = ''.join(part('roadmap-item', number=e(item['number']), text=e(item['text'])) for item in stage['roadmap'])
        roadmap = part('roadmap', items=roadmap_items) if roadmap_items else ''
        hero_stage = part('image-stage', roadmap=roadmap, **{key: e(stage[key]) for key in ('src', 'alt', 'label', 'caption')})
    else:
        raise ValueError(f'Unknown hero stage kind: {stage["kind"]}')

    projects = []
    for project in page['projects']:
        whole_link = project.get('whole_link', False)
        link = project.get('link', '')
        image = part('project-image', src=e(project['image']), alt=e(project['alt']))
        video = project.get('video')
        error = ''
        if video:
            image += part('project-video', poster=e(project['image']), **{key: e(video[key]) for key in ('id', 'src', 'label', 'button_label')})
            error = part('video-error', text=e(video['error']))
        elif link:
            image += part('project-open')
            if not whole_link:
                image = part('project-media-link', url=e(link), content=image)
        project_link = ''
        if link:
            project_link = part('project-link', tag='span' if whole_link else 'a', href='' if whole_link else f' href="{e(link)}"')
        facts = ''.join(part('project-fact', value=e(value), text=e(text)) for value, text in project['facts'])
        copy = part('project-copy', facts=facts, link=project_link, **{key: e(project[key]) for key in ('meta', 'title', 'copy')})
        css_class = 'project service-case' if service else 'project project-demo' if video else 'project'
        attrs = f' id="{e(project["id"])}"' if project.get('id') else ''
        if whole_link:
            attrs += f' href="{e(link)}"'
        projects.append(part('project', tag='a' if whole_link else 'article', css_class=css_class,
            attrs=attrs, media=image, label=e(project['label']), copy=copy, error=error))
    project_markup = ''.join(projects)
    if not service:
        project_markup = part('project-grid', projects=project_markup)
    next_step = page.get('next_step')
    next_markup = part('project-next', **{key: e(value) for key, value in next_step.items()}) if next_step else ''

    proof = []
    for item in page['proof']:
        strong = part('proof-value', value=e(item['value']), direction=f' dir="{e(item["direction"])}"' if item['direction'] else '') if item['value'] else ''
        proof.append(part('proof', value=strong + ' ' if strong else '', text=e(item['text'])))
    solutions = ''.join(part('solution', number=f'{i:02d}', icon=svg(item['icon']), **{key: e(item[key]) for key in ('label', 'title', 'text')}) for i, item in enumerate(page['solutions'], 1))
    steps = ''.join(part('step', number=f'{i:02d}', icon=svg(item['icon']), **{key: e(item[key]) for key in ('title', 'text', 'output')}) for i, item in enumerate(page['steps'], 1))
    faqs = ''.join(part('faq', question=e(question), answer=e(answer)) for question, answer in page['faqs'])
    related = ''.join(part('related-link', slug=e(other['slug']), title=e(other['title'])) for other in pages if other['slug'] != slug)

    schemas = [
        {'@context': 'https://schema.org', '@type': 'Service', 'name': title, 'description': page['description'], 'url': url,
         'provider': {'@type': 'Organization', 'name': 'Red Crown Interactive', 'url': 'https://redcrowninteractive.com/'}, 'areaServed': 'IL'},
        {'@context': 'https://schema.org', '@type': 'FAQPage', 'inLanguage': 'he', 'mainEntity': [
            {'@type': 'Question', 'name': question, 'acceptedAnswer': {'@type': 'Answer', 'text': answer}} for question, answer in page['faqs']]},
        {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Red Crown Interactive', 'item': 'https://redcrowninteractive.com/he/'},
            {'@type': 'ListItem', 'position': 2, 'name': page['breadcrumb'], 'item': url}]}]
    structured_data = ''.join(part('schema', json=json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c')) for schema in schemas)

    return part('page', slug=e(slug), title=e(title), url=e(url), description=e(page['description']), theme_color=e(page['theme_color']),
        body_class=f'service-landing service-{e(slug)}' if service else 'vr-page',
        extra_css=part('service-style') if service else '', structured_data=structured_data,
        eyebrow=e(page['eyebrow']), headline=heading(page['headline']), lead=lines(page['lead']), stage=hero_stage, proof=''.join(proof),
        work_title=heading(page['work_title']), work_eyebrow=e(page['work_eyebrow']), work_intro=lines(page['work_intro']), projects=project_markup, next_step=next_markup,
        solutions_title=heading(page['solutions_title']), solutions_eyebrow=e(page['solutions_eyebrow']), solutions_intro=e(page['solutions_intro']), solutions=solutions,
        steps=steps, faqs=faqs, journey_alias=part('journey-alias') if page['journey_alias'] else '',
        related_section=part('related', related=related) if page['related'] else '',
        contact_title=heading(page['contact_title']), contact_lead=e(page['contact_lead']), project_type=e(page['project_type']),
        consultation=''.join(part('consultation-item', text=e(item)) for item in page['consultation']),
        wa_url=e(page['contact_whatsapp_url']), whatsapp_url=e(page['whatsapp_url']), footer_description=e(page['footer_description']),
        model_credit=part('model-credit') if page.get('model_credit') else '', model_script=part('model-script') if stage['kind'] == 'model' else '') + '\n'
