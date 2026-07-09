import { render, screen } from '@testing-library/react';
import MetaProgressCard from './MetaProgressCard';

describe('MetaProgressCard', () => {
  it('renders the meta, current value and progress percentage', () => {
    render(<MetaProgressCard meta={1000} currentValue={750} />);

    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('Valor actual')).toBeInTheDocument();
    expect(screen.getByText('750')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('caps the percentage at 100%', () => {
    render(<MetaProgressCard meta={100} currentValue={150} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders 0% when the meta is zero', () => {
    render(<MetaProgressCard meta={0} currentValue={50} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('returns null when no meta is provided', () => {
    const { container } = render(<MetaProgressCard meta={null} currentValue={100} />);

    expect(container.firstChild).toBeNull();
  });
});
