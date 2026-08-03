import { render } from '@testing-library/react';
import GroupDisplayHeader from './GroupDisplayHeader';

describe('GroupDisplayHeader', () => {
  it('renders nothing until a group is active', () => {
    // Without an active group the component returns null. The old name claimed
    // it rendered placeholder information, and nothing checked either way.
    const { container } = render(<GroupDisplayHeader />);

    expect(container).toBeEmptyDOMElement();
  });
});
