import type { Metadata } from 'next';
import Customiser from '@/components/customiser/Customiser';

export const metadata: Metadata = { title: 'Thiết kế bó hoa 3D · Bạn tìm hoa, tôi có hoa' };

export default function DesignPage() {
  return <Customiser />;
}
