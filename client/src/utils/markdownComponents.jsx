// Shared overrides for ReactMarkdown.
// External links open in a new tab with rel="noopener noreferrer" to prevent
// reverse tabnabbing and to keep the kanban tab alive.

export const MARKDOWN_LINK_COMPONENTS = {
  a: ({ node, href, children, ...rest }) => {
    const isExternal = typeof href === 'string' && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...(isExternal
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        {...rest}
      >
        {children}
      </a>
    );
  },
};
