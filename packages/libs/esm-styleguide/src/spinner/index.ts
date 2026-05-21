/** @module @category UI */

export function renderLoadingSpinner(target: HTMLElement) {
  const template = document.querySelector<HTMLTemplateElement>('template#loading-spinner');

  if (template) {
    const frag = template.content.cloneNode(true);
    const refs = Array.from(frag.childNodes);
    target.appendChild(frag);
    return () => {
      refs.forEach((child: ChildNode) => {
        child.remove();
      });
    };
  }

  return () => {};
}
