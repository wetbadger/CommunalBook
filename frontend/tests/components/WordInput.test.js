// frontend/tests/components/WordInput.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import WordInput from '../../src/components/WordInput.vue';

describe('WordInput', () => {
  let wrapper;

  beforeEach(() => {
    // Skip if document isn't available (shouldn't happen with jsdom)
    if (typeof document === 'undefined') {
      return;
    }
    
    wrapper = mount(WordInput, {
      props: {
        mode: 'inline',
        isActive: true,
        autoFocus: false
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true
        }
      }
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it('renders correctly in inline mode', () => {
    if (!wrapper) return;
    expect(wrapper.exists()).toBe(true);
    const element = wrapper.element;
    expect(element.classList.contains('word-input')).toBe(true);
    expect(element.classList.contains('inline-mode')).toBe(true);
  });

  it('emits submit event when word is entered', async () => {
    if (!wrapper) return;
    const element = wrapper.element;
    element.textContent = 'Hello';
    
    await wrapper.trigger('input');
    await wrapper.trigger('keydown', { key: ' ' });
    
    expect(wrapper.emitted('submit')).toBeTruthy();
    if (wrapper.emitted('submit')) {
      expect(wrapper.emitted('submit')[0][0].text).toBe('Hello');
    }
  });

  it('emits cancel event on Escape key', async () => {
    if (!wrapper) return;
    await wrapper.trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('cancel')).toBeTruthy();
  });

  it('clears input after submit', async () => {
    if (!wrapper) return;
    const element = wrapper.element;
    element.textContent = 'Test';
    
    await wrapper.trigger('input');
    await wrapper.trigger('keydown', { key: ' ' });
    
    expect(wrapper.vm.getText()).toBe('');
  });
});