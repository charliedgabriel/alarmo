import { LitElement, html, customElement, property } from 'lit-element';
import { HomeAssistant, navigate } from 'custom-card-helpers';
import { commonStyle } from '../styles';
import { localize } from '../../localize/localize';

import '../components/alarmo-multi-select';

import { triggerOptions, targetOptions, defaultNotificationData, messagePlaceHolder } from '../data/notifications';
import { AlarmoNotification } from '../types';
import { fetchAutomations, deleteAutomation, saveAutomation } from '../data/websockets';
import { handleError, omit } from '../helpers';

@customElement('notification-editor-card')
export class NotificationEditorCard extends LitElement {
  hass!: HomeAssistant;
  @property() narrow!: boolean;

  @property() item?: string;
  @property() data?: AlarmoNotification;

  @property() yamlMode = false;

  yamlCode?: Object;

  async firstUpdated() {
    this.data = { ...defaultNotificationData };
    if (this.item) {
      const automations = await fetchAutomations(this.hass);
      const data = omit(automations[this.item], ['automation_id']);
      this.data = data as unknown as AlarmoNotification;
    }
  }

  render() {
    if (!this.data) return html``;
    return html`
<ha-card>
  <div class="card-header">
    <div class="name">
      ${localize("panels.actions.cards.new_notification.title", this.hass.language)}
    </div>
    <ha-icon-button
      icon="hass:close"
      @click=${this.cancelClick}
    >
    </ha-icon-button>
  </div>
  <div class="card-content">
      ${localize("panels.actions.cards.new_notification.description", this.hass.language)}
  </div>

  <div style="text-align: right; padding: 0px 16px 16px 16px">
    <mwc-button @click=${this.toggleYaml}>
      ${this.yamlMode
        ? localize("panels.actions.cards.new_notification.actions.ui_mode", this.hass.language)
        : localize("panels.actions.cards.new_notification.actions.yaml_mode", this.hass.language)
      }
    </mwc-button>
  </div>

  ${
      this.yamlMode
        ?
        html`
      <ha-yaml-editor
        .label="Label"
        .name="Data"  
        .defaultValue=${this.data}
        @value-changed=${(ev: CustomEvent) => { this.yamlCode = ev.detail.value }}
      >
      </ha-yaml-editor>
    `
        :
        html`

  <settings-row .narrow=${this.narrow}>
    <span slot="heading">${localize("panels.actions.cards.new_notification.fields.name.heading", this.hass.language)}</span>
    <span slot="description">${localize("panels.actions.cards.new_notification.fields.name.description", this.hass.language)}</span>

    <paper-input
      label="${localize("panels.actions.cards.new_notification.fields.name.heading", this.hass.language)}"
      placeholder=""
      value=${this.data.name}
      @change=${(ev: Event) => this.data = { ...this.data!, name: (ev.target as HTMLInputElement).value }}
    >
    </paper-input>
  </settings-row>

  <settings-row .narrow=${this.narrow}>
    <span slot="heading">${localize("panels.actions.cards.new_notification.fields.event.heading", this.hass.language)}</span>
    <span slot="description">${localize("panels.actions.cards.new_notification.fields.event.description", this.hass.language)}</span>

    <alarmo-multi-select
      .options=${Object.values(triggerOptions(this.hass))}
      .value=${this.data.triggers.map(trigger => triggerOptions(this.hass).find(e => JSON.stringify(e.trigger) == JSON.stringify(trigger))!.value)}
      @change=${(ev: Event) => this.updateTriggers((ev.target as HTMLInputElement).value as unknown as string[])}
    </alarmo-multi-select>
  </settings-row>

  <settings-row .narrow=${this.narrow}>
    <span slot="heading">${localize("panels.actions.cards.new_notification.fields.title.heading", this.hass.language)}</span>
    <span slot="description">${localize("panels.actions.cards.new_notification.fields.title.description", this.hass.language)}</span>

    <paper-input
      label="${localize("panels.actions.cards.new_notification.fields.title.heading", this.hass.language)}"
      placeholder=""
      value=${this.data.actions[0].service_data.title || ""}
      @change=${(ev: Event) => this.updateTitle((ev.target as HTMLInputElement).value)}
    >
    </paper-input>
  </settings-row>

    <settings-row .narrow=${this.narrow} .large=${true}>
    <span slot="heading">${localize("panels.actions.cards.new_notification.fields.message.heading", this.hass.language)}</span>
    <span slot="description">${localize("panels.actions.cards.new_notification.fields.message.description", this.hass.language)}</span>

    <paper-textarea
      label="${localize("panels.actions.cards.new_notification.fields.message.heading", this.hass.language)}"
      placeholder=${messagePlaceHolder(this.data)}
      value=${this.data.actions[0].service_data.message || ""}
      @blur=${(ev: Event) => { this.updateMessage((ev.target as HTMLInputElement).value) }}
    >
    </paper-textarea>
  </settings-row>

  <settings-row .narrow=${this.narrow}>
    <span slot="heading">${localize("panels.actions.cards.new_notification.fields.target.heading", this.hass.language)}</span>
    <span slot="description">${localize("panels.actions.cards.new_notification.fields.target.description", this.hass.language)}</span>

    <alarmo-multi-select
      .options=${this.getTargetList()}
      .value=${this.data.actions.map(action => action.service)}
      @change=${(ev: Event) => this.updateTargets((ev.target as HTMLInputElement).value as unknown as string[])}
    </alarmo-multi-select>
  </settings-row>
  `}
        
  <div class="card-actions">
    <mwc-button @click=${this.saveClick}>
      ${this.hass.localize("ui.common.save")}
    </mwc-button>

  ${this.item
        ? html`
    <mwc-button
      class="warning"
      @click=${this.deleteClick}
    >
      ${this.hass.localize("ui.common.delete")}
    </mwc-button>`
        :
        ''
      }
  </div>
</ha-card>
    `;
  }

  private getTargetList() {
    return [
      ...Object.values(targetOptions(this.hass)),
      , ...this.data!.actions
        .filter(action => !targetOptions(this.hass).find(e => e.value == action.service))
        .map(e => Object({ value: e.service }))
    ];
  }

  private updateTriggers(value: string[]) {
    this.data = {
      ...this.data!,
      triggers: value.map(val => triggerOptions(this.hass).find(e => e.value == val)!.trigger)
    };
  }

  private updateTitle(value: string) {
    this.data = {
      ...this.data!,
      actions: this.data!.actions.map(action => Object(
        {
          ...action,
          service_data: {
            ...action.service_data,
            title: value
          }
        }
      ))
    }
  }

  private updateMessage(value: string) {
    this.data = {
      ...this.data!,
      actions: this.data!.actions.map(action => Object(
        {
          ...action,
          service_data: {
            ...action.service_data,
            message: value
          }
        }
      ))
    }
  }

  private updateTargets(value: string[]) {
    this.data = {
      ...this.data!,
      actions: value.map(e => Object(
        {
          service: e,
          service_data: { ...this.data!.actions[0].service_data }
        }
      ))
    };
  }

  private deleteClick(ev: Event) {
    if (!this.item) return;
    deleteAutomation(this.hass, this.item)
      .catch(e => handleError(e, ev))
      .then(() => { this.cancelClick() });
  }


  private saveClick(ev: Event) {
    let data = { ...this.data, is_notification: true };
    if (this.item) data = { ...data, automation_id: this.item };
    saveAutomation(this.hass, data)
      .catch(e => handleError(e, ev))
      .then(() => { this.cancelClick() });
  }

  private toggleYaml() {
    if (!this.data) return;
    this.yamlMode = !this.yamlMode;
    if (!this.yamlMode && this.yamlCode) {
      this.data = { ...this.yamlCode } as AlarmoNotification;
    }
  }

  private cancelClick() {
    navigate(this, "/alarmo/actions", true);
  }

  static styles = commonStyle;
}
