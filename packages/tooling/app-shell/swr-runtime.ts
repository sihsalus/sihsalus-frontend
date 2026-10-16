// Publish the lazy shared providers in the host graph, including entry points
// that the shell does not consume directly. Keep loading behind an async boundary.
void import('swr');
void import('swr/infinite');
void import('swr/immutable');
void import('swr/_internal');
