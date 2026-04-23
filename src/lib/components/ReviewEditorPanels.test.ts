import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import CharacterReviewPanel from './CharacterReviewPanel.svelte';
import RuleBookPanel from './RuleBookPanel.svelte';
import WorldBookPanel from './WorldBookPanel.svelte';
import type { CharacterCard, RuleDefinition, WorldBookEntry } from '$lib/types';

const character: CharacterCard = {
  id: 'c1',
  name: '宁昭',
  gender: '女',
  age: 24,
  identity: '守门人',
  faction: '临川城',
  role: '关键配角',
  summary: '守门人，负责在夜里巡查北门。',
  desire: '守住城门',
  secrets: [],
  traits: [],
  abilities: [],
  mutable_state: {}
};

const worldbookEntry: WorldBookEntry = {
  id: 'w1',
  title: '地点：北门',
  category: 'location',
  content: '午夜之后绝不能打开北门。',
  enabled: true,
  keys: ['北门'],
  secondary_keys: [],
  selective_logic: 'and_any',
  constant: false,
  recursive: false,
  exclude_recursion: false,
  prevent_recursion: false,
  delay_until_recursion: null,
  scan_depth: 4,
  case_sensitive: false,
  match_whole_words: false,
  sticky: null,
  cooldown: null,
  delay: null,
  triggers: [],
  ignore_budget: false,
  order: 1,
  insertion_mode: 'rules_guard',
  source: 'character_card',
  rule_binding: null
};

const rule: RuleDefinition = {
  id: 'r1',
  name: 'north-gate-midnight-forbidden',
  category: 'world',
  priority: 'hard_constraint',
  enabled: true,
  conditions: [],
  blockers: [],
  effects: [],
  explanation: '午夜之后绝不能打开北门'
};

describe('review editor panels', () => {
  it('renders the worldbook panel with document-style archive semantics', () => {
    render(WorldBookPanel, {
      props: {
        entries: [worldbookEntry],
        activeId: 'w1',
        draft: { ...worldbookEntry, source: 'character_card', insertion_mode: 'codex_only' },
        dirty: false,
        saveBusy: false,
        deleteBusy: false
      }
    });

    const documentHead = screen.getByTestId('worldbook-document-head');
    expect(within(documentHead).getByText('世界书')).toBeInTheDocument();
    expect(within(documentHead).getByText('阅读侧栏')).toBeInTheDocument();
    expect(within(documentHead).getByText('角色卡')).toBeInTheDocument();
    expect(within(documentHead).getByRole('heading', { name: '地点：北门' })).toBeInTheDocument();
    expect(screen.queryByText('character_card')).not.toBeInTheDocument();

    const enabledRow = screen.getByTestId('worldbook-enabled-row');
    expect(within(enabledRow).getByText('状态')).toBeInTheDocument();
    expect(within(enabledRow).getByLabelText('启用条目')).toBeChecked();

    const footer = screen.getByTestId('worldbook-editor-footer');
    const footerButtons = within(footer)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim());
    expect(footerButtons).toEqual(['删除条目', '保存更改']);
  });

  it('renders the rule panel with document-style archive semantics', () => {
    render(RuleBookPanel, {
      props: {
        rules: [rule],
        activeId: 'r1',
        draft: rule,
        dirty: true,
        saveBusy: false,
        deleteBusy: false
      }
    });

    const documentHead = screen.getByTestId('rule-document-head');
    expect(within(documentHead).getByText('规则')).toBeInTheDocument();
    expect(within(documentHead).getByText('硬约束', { selector: 'span' })).toBeInTheDocument();
    expect(within(documentHead).getByRole('heading', { name: 'north-gate-midnight-forbidden' })).toBeInTheDocument();

    const enabledRow = screen.getByTestId('rule-enabled-row');
    expect(within(enabledRow).getByText('状态')).toBeInTheDocument();
    expect(within(enabledRow).getByLabelText('启用规则')).toBeChecked();

    const nameField = screen.getByTestId('rule-name-field');
    expect(within(nameField).getByText('名称')).toBeInTheDocument();
    expect(within(nameField).getByDisplayValue('north-gate-midnight-forbidden')).toBeInTheDocument();
    expect(within(nameField).queryByRole('combobox')).not.toBeInTheDocument();

    const attributeRow = screen.getByTestId('rule-attribute-row');
    expect(within(attributeRow).getByText('优先级')).toBeInTheDocument();
    expect(within(attributeRow).getByRole('combobox')).toHaveDisplayValue('硬约束');

    const footer = screen.getByTestId('rule-editor-footer');
    const footerButtons = within(footer)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim());
    expect(footerButtons).toEqual(['删除规则', '保存更改']);
  });

  it('renders the character panel with document-style archive semantics', () => {
    render(CharacterReviewPanel, {
      props: {
        cards: [character],
        activeId: 'c1',
        draft: character,
        dirty: false,
        saveBusy: false
      }
    });

    const documentHead = screen.getByTestId('character-document-head');
    expect(within(documentHead).getByText('角色卡')).toBeInTheDocument();
    expect(within(documentHead).getByText('关键配角')).toBeInTheDocument();
    expect(within(documentHead).getByRole('heading', { name: '宁昭' })).toBeInTheDocument();
    expect(within(documentHead).getByText('守门人 · 临川城')).toBeInTheDocument();

    const footer = screen.getByTestId('character-editor-footer');
    expect(within(footer).getByText('已与当前项目同步')).toBeInTheDocument();
    expect(within(footer).getByRole('button', { name: '保存更改' })).toBeInTheDocument();
  });
});
