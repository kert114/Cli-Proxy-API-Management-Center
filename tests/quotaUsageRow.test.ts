import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuotaUsageRow } from '@/features/quota/components/QuotaUsageRow';
import { bindQuotaClasses, QUOTA_CLASS_KEYS } from '@/features/quota/types';

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test-host'
);

describe('shared remaining quota row', () => {
  test.each([
    [25, '75%', '75', 'quotaBarFillHigh'],
    [10, '90%', '90', 'quotaBarFillHigh'],
    [15, '85%', '85', 'quotaBarFillHigh'],
    [60, '40%', '40', 'quotaBarFillMedium'],
    [90, '10%', '10', 'quotaBarFillLow'],
    [25.4, '75%', '74.6', 'quotaBarFillHigh'],
    [0, '100%', '100', 'quotaBarFillHigh'],
    [100, '0%', '0', 'quotaBarFillLow'],
    [120, '0%', '0', 'quotaBarFillLow'],
    [-10, '100%', '100', 'quotaBarFillHigh'],
  ])('shows remaining quota for %s percent used', (usedPercent, label, remaining, color) => {
    const markup = renderToStaticMarkup(
      createElement(QuotaUsageRow, { label: 'Included usage', usedPercent, classes })
    );

    expect(markup).toContain(`<span class="quotaPercent">${label}</span>`);
    expect(markup).toContain(`aria-valuenow="${remaining}"`);
    expect(markup).toContain(`width:${remaining}%`);
    expect(markup).toContain(`quotaBarFill ${color}`);
    expect(markup).not.toContain('% used');
  });

  test('keeps missing quota distinct from fully exhausted quota', () => {
    for (const unknownLabel of [undefined, 'Not reported']) {
      const markup = renderToStaticMarkup(
        createElement(QuotaUsageRow, {
          label: 'Included usage',
          usedPercent: null,
          classes,
          unknownLabel,
        })
      );

      expect(markup).toContain(`<span class="quotaPercent">${unknownLabel ?? '--'}</span>`);
      expect(markup).not.toContain('role="meter"');
      expect(markup).not.toContain('aria-valuenow');
      expect(markup).not.toContain('<span class="quotaPercent">0%</span>');
    }
  });

  test('preserves provider labels and reset metadata alongside the remaining percentage', () => {
    const markup = renderToStaticMarkup(
      createElement(
        QuotaUsageRow,
        {
          label: '5-hour limit',
          meterLabel: '5-hour quota remaining',
          usedPercent: 20,
          classes,
          title: 'Resets soon',
          index: 1,
        },
        createElement('span', { className: classes.quotaReset }, '10-08 18:00')
      )
    );

    expect(markup).toContain('title="Resets soon"');
    expect(markup).toContain('<span class="quotaModel">5-hour limit</span>');
    expect(markup).toContain(
      '<div class="quotaMeta"><span class="quotaPercent">80%</span><span class="quotaReset">10-08 18:00</span></div>'
    );
    expect(markup).toContain('aria-label="5-hour quota remaining"');
    expect(markup).toContain('--meter-index:1');
  });
});
