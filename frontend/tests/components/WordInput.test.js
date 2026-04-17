import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import WordInput from '../../src/components/WordInput.vue';

describe('WordInput', () => {
  it('renders correctly in inline mode', () => {
    const wrapper = mount(WordInput, {
      props: {
        mode: 'inline',
        isActive: true,
        autoFocus: false
      }
    });
    
    expect(wrapper.classes()).toContain('word-input');
    expect(wrapper.classes()).toContain('inline-mode');
  });

  it('emits submit event when word is entered', async () => {
    const wrapper = mount(WordInput, {
      props: {
        mode: 'inline',
        isActive: true,
        autoFocus: false
      }
    });
    
    // Set content
    await wrapper.setValue('Hello');
    
    // Trigger input event with space (should submit)
    await wrapper.trigger('input', { target: { textContent: 'Hello ' } });
    
    expect(wrapper.emitted('submit')).toBeTruthy();
    expect(wrapper.emitted('submit')[0][0].text).toBe('Hello');
  });

  it('emits cancel event on Escape key', async () => {
    const wrapper = mount(WordInput, {
      props: {
        mode: 'inline',
        isActive: true,
        autoFocus: false
      }
    });
    
    await wrapper.trigger('keydown', { key: 'Escape' });
    
    expect(wrapper.emitted('cancel')).toBeTruthy();
  });

  it('clears input after submit', async () => {
    const wrapper = mount(WordInput, {
      props: {
        mode: 'inline',
        isActive: true,
        autoFocus: false
      }
    });
    
    await wrapper.setValue('Test');
    await wrapper.trigger('input', { target: { textContent: 'Test ' } });
    
    expect(wrapper.vm.getText()).toBe('');
  });
});