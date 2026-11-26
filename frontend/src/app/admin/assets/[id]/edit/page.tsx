'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AssetForm } from '@/components/AssetForm';

export default function EditAssetPage() {
  const params = useParams<{ id: string }>();
  return <AssetForm assetId={params.id} />;
}
