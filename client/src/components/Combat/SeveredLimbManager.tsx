import { useMemo } from 'react';
import { useCombatStore } from '../../hooks/useCombatStore';
import { SeveredLimb, type LimbVariant } from './SeveredLimb';

interface SeveredLimbManagerProps {
  enemyPosition: [number, number, number];
}

const BONE_VARIANT_IDS = new Set(['SKELETON']);

// Physics spawn offsets matching the flipped perspective
const PART_OFFSETS: Record<string, [number, number, number]> = {
  head: [0, 1.8, 0],
  // Enemy's Left side -> Screen Right (+X)
  l_arm: [0.5, 1.2, 0],
  l_wing: [0.6, 1.5, -0.2],
  l_leg: [0.3, 0.4, 0],
  // Enemy's Right side -> Screen Left (-X)
  r_arm: [-0.5, 1.2, 0],
  r_wing: [-0.6, 1.5, -0.2],
  r_leg: [-0.3, 0.4, 0],
};

export const SeveredLimbManager = ({ enemyPosition }: SeveredLimbManagerProps) => {
  const enemyParts = useCombatStore((state) => state.enemyInstance?.parts);
  const enemyId = useCombatStore((state) => state.enemyInstance?.instanceId);

  const variant: LimbVariant = useMemo(() => {
    const baseId = enemyId?.split('-')[0].toUpperCase();
    return baseId && BONE_VARIANT_IDS.has(baseId) ? 'bone' : 'flesh';
  }, [enemyId]);

  const spawnedLimbs = useMemo(
    () => enemyParts?.filter((part) => part.isSevered).map((part) => part.id) ?? [],
    [enemyParts]
  );

  return (
    <group name="severed-limbs-container">
      {spawnedLimbs.map((partId) => {
        // Fallback to center/middle if the part ID isn't in our dictionary
        const offset = PART_OFFSETS[partId] || [0, 1.0, 0];

        const spawnPosition: [number, number, number] = [
          enemyPosition[0] + offset[0],
          enemyPosition[1] + offset[1],
          enemyPosition[2] + offset[2],
        ];

        return (
          <SeveredLimb
            key={`${enemyId}-${partId}`}
            partId={partId}
            initialPosition={spawnPosition}
            variant={variant}
          />
        );
      })}
    </group>
  );
};
