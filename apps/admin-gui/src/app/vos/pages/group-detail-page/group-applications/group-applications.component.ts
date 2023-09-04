import { ChangeDetectorRef, Component, HostBinding, OnInit } from '@angular/core';
import {
  Application,
  AppState,
  AttributeDefinition,
  AttributesManagerService,
  Group,
  RegistrarManagerService,
} from '@perun-web-apps/perun/openapi';
import {
  TABLE_GROUP_APPLICATIONS_DETAILED,
  TABLE_GROUP_APPLICATIONS_NORMAL,
} from '@perun-web-apps/config/table-config';
import {
  EntityStorageService,
  GuiAuthResolver,
  PerunTranslateService,
} from '@perun-web-apps/perun/services';
import { UntypedFormControl } from '@angular/forms';
import { formatDate } from '@angular/common';
import { getDefaultDialogConfig } from '@perun-web-apps/perun/utils';
import { ApplicationsListColumnsChangeDialogComponent } from '../../../../shared/components/dialogs/applications-list-columns-change-dialog/applications-list-columns-change-dialog.component';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { ApplicationsBulkOperationDialogComponent } from '@perun-web-apps/perun/dialogs';

@Component({
  selector: 'app-group-applications',
  templateUrl: './group-applications.component.html',
  styleUrls: ['./group-applications.component.scss'],
})
export class GroupApplicationsComponent implements OnInit {
  static id = 'GroupApplicationsComponent';

  // used for router animation
  @HostBinding('class.router-component') true;
  currentStates: AppState[] = ['NEW', 'VERIFIED'];
  group: Group;
  prependColumns: string[] = ['checkbox', 'id'];
  simpleColumns: string[] = ['createdAt', 'type', 'state', 'createdBy', 'modifiedBy'];
  detailedColumns: string[] = [
    'createdAt',
    'type',
    'state',
    'extSourceName',
    'extSourceType',
    'user',
    'createdBy',
    'modifiedBy',
    'modifiedAt',
    'fedInfo',
  ];
  filterValue = '';
  showAllDetails = false;
  detailTableId = TABLE_GROUP_APPLICATIONS_DETAILED;
  tableId = TABLE_GROUP_APPLICATIONS_NORMAL;
  refresh = false;
  startDate: UntypedFormControl;
  endDate: UntypedFormControl;
  fedAttrs: AttributeDefinition[] = [];
  currentColumns: string[] = [];
  configuredColumns: string[] = [];
  configuredFedColumns: string[] = [];
  columnsAuth = false;
  loading$: Observable<boolean>;
  selectedApplications: Application[] = [];
  canApprove = false;
  canReject = false;
  canDelete = false;
  canSendNotification = false;
  tooltipMessages = {
    approve: '',
    reject: '',
    delete: '',
    sendNotifications: '',
  };
  approveAuth: boolean;
  rejectAuth: boolean;
  deleteAuth: boolean;
  resendAuth: boolean;

  constructor(
    private registrarManager: RegistrarManagerService,
    private guiAuthResolver: GuiAuthResolver,
    private entityStorageService: EntityStorageService,
    private attributeManager: AttributesManagerService,
    private dialog: MatDialog,
    private cd: ChangeDetectorRef,
    private translate: PerunTranslateService,
    private authResolver: GuiAuthResolver
  ) {}

  ngOnInit(): void {
    this.loading$ = of(true);
    this.group = this.entityStorageService.getEntity();
    this.startDate = new UntypedFormControl(formatDate(this.yearAgo(), 'yyyy-MM-dd', 'en-GB'));
    this.endDate = new UntypedFormControl(formatDate(new Date(), 'yyyy-MM-dd', 'en-GB'));
    this.attributeManager
      .getIdpAttributeDefinitions()
      .subscribe((attrDefs: AttributeDefinition[]) => {
        attrDefs.forEach((attr) => {
          if (!this.fedAttrs.includes(attr)) {
            this.fedAttrs.push(attr);
          }
        });
      });
    this.loadViewConfiguration();
    this.setAuthRights();
    this.setButtonsTooltips();
  }

  yearAgo(): Date {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() - 365);
    return newDate;
  }

  applyFilter(filterValue: string): void {
    this.filterValue = filterValue;
  }

  showDetails(value: boolean): void {
    this.showAllDetails = value;
    this.loadViewConfiguration();
  }
  refreshColumns(): string[] {
    this.cd.detectChanges();
    if (this.showAllDetails) {
      return this.prependColumns.concat(this.detailedColumns);
    }
    if (this.configuredColumns.length > 0) {
      return this.prependColumns.concat(this.configuredColumns);
    }
    return this.prependColumns.concat(this.simpleColumns);
  }

  loadViewConfiguration(): void {
    this.cd.detectChanges();
    this.attributeManager
      .getGroupAttributeByName(
        this.group.id,
        'urn:perun:group:attribute-def:def:applicationViewPreferences'
      )
      .subscribe((attribute) => {
        if (
          attribute?.value !== undefined &&
          attribute?.value !== null &&
          (attribute?.value as Array<string>).length > 0
        ) {
          this.configuredColumns = attribute.value as Array<string>;
          this.configuredFedColumns = this.configuredColumns.filter((column) =>
            this.fedAttrs.some((attr) => attr.friendlyName === column)
          );
        } else {
          this.configuredColumns = [];
          this.configuredFedColumns = [];
        }
        this.columnsAuth = attribute.writable;
        this.currentColumns = this.refreshColumns();
      });
  }

  setColumns(): void {
    const config = getDefaultDialogConfig();
    config.width = '650px';
    config.data = {
      columns: [],
      groupId: this.group.id,
      voId: this.group.voId,
      theme: 'group-theme',
    };

    const dialogRef = this.dialog.open(ApplicationsListColumnsChangeDialogComponent, config);
    dialogRef.afterClosed().subscribe((success) => {
      if (success) {
        this.loadViewConfiguration();
      }
    });
  }

  refreshTable(): void {
    this.refresh = !this.refresh;
    this.cd.detectChanges();
  }

  setAuthRights(): void {
    this.approveAuth = this.authResolver.isAuthorized('vo-approveApplicationInternal_int_policy', [
      this.group,
    ]);
    this.rejectAuth = this.authResolver.isAuthorized('vo-rejectApplication_int_String_policy', [
      this.group,
    ]);
    this.deleteAuth = this.authResolver.isAuthorized('vo-deleteApplication_Application_policy', [
      this.group,
    ]);
    this.resendAuth = this.authResolver.isAuthorized(
      'vo-sendMessage_Application_MailType_String_policy',
      [this.group]
    );
  }

  onSelectedApplicationsChange(applications: Application[]): void {
    this.selectedApplications = applications;
    this.checkButtonStates();
  }

  checkButtonStates(): void {
    const singleStateSelected = this.singleStateSelected();
    let state = null;
    if (singleStateSelected) {
      state = this.selectedApplications[0].state;
    }
    this.canApprove = singleStateSelected && (state === 'NEW' || state === 'VERIFIED');
    this.canReject = singleStateSelected && (state === 'NEW' || state === 'VERIFIED');
    this.canDelete = singleStateSelected && (state === 'NEW' || state === 'REJECTED');
    this.canSendNotification = singleStateSelected;

    this.setButtonsTooltips();
  }

  singleStateSelected(): boolean {
    const length = this.selectedApplications.length;
    if (length === 0) {
      return false;
    }
    if (length === 1) {
      return true;
    }
    const firstState = this.selectedApplications[0].state;
    return !this.selectedApplications.some((application) => application.state !== firstState);
  }

  onApproveClicked(): void {
    const dialogRef = this.openDialog(
      'APPROVE',
      'VO_DETAIL.APPLICATION.DIALOG.APPROVE.TITLE',
      'VO_DETAIL.APPLICATION.DIALOG.APPROVE.DESCRIPTION',
      'VO_DETAIL.APPLICATION.APPLICATION_DETAIL.APPROVE'
    );
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // TODO
      }
    });
  }

  onRejectClicked(): void {
    const dialogRef = this.openDialog(
      'REJECT',
      'VO_DETAIL.APPLICATION.DIALOG.REJECT.TITLE',
      'VO_DETAIL.APPLICATION.DIALOG.REJECT.DESCRIPTION',
      'VO_DETAIL.APPLICATION.APPLICATION_DETAIL.REJECT'
    );
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // TODO
      }
    });
  }

  onDeleteClicked(): void {
    const dialogRef = this.openDialog(
      'DELETE',
      'VO_DETAIL.APPLICATION.DIALOG.DELETE.TITLE',
      'VO_DETAIL.APPLICATION.DIALOG.DELETE.DESCRIPTION',
      'VO_DETAIL.APPLICATION.APPLICATION_DETAIL.DELETE'
    );
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // TODO
      }
    });
  }

  onResendClicked(): void {
    const dialogRef = this.openDialog(
      'RESEND',
      'VO_DETAIL.APPLICATION.DIALOG.RESEND.TITLE',
      'VO_DETAIL.APPLICATION.DIALOG.RESEND.DESCRIPTION',
      'VO_DETAIL.APPLICATION.APPLICATION_DETAIL.SEND_NOTIFICATION'
    );
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // TODO
      }
    });
  }

  openDialog(
    selectedAction: 'APPROVE' | 'REJECT' | 'DELETE' | 'RESEND',
    title: string,
    description: string,
    confirmButtonLabel: string
  ): MatDialogRef<ApplicationsBulkOperationDialogComponent> {
    const columnsToDisplay = this.currentColumns.filter(
      (column) => column !== 'checkbox' && column !== 'state'
    );

    const config = getDefaultDialogConfig();
    config.maxWidth = '1300px';
    config.minWidth = '280px';
    config.maxHeight = '700px';
    config.minHeight = '300px';
    config.data = {
      displayedColumns: columnsToDisplay,
      selectedApplications: this.selectedApplications,
      action: selectedAction,
      title: title,
      description: description,
      confirmButtonLabel: confirmButtonLabel,
      groupId: this.group.id,
    };

    const dialogRef = this.dialog.open(ApplicationsBulkOperationDialogComponent, config);
    return dialogRef;
  }

  private setButtonsTooltips(): void {
    if (this.singleStateSelected()) {
      const state = this.selectedApplications[0]?.state;
      this.tooltipMessages.approve = this.translate.instant(
        `VO_DETAIL.APPLICATION.TOOLTIPS.APPROVE.${state}`
      );
      this.tooltipMessages.reject = this.translate.instant(
        `VO_DETAIL.APPLICATION.TOOLTIPS.REJECT.${state}`
      );
      this.tooltipMessages.delete = this.translate.instant(
        `VO_DETAIL.APPLICATION.TOOLTIPS.DELETE.${state}`
      );
      this.tooltipMessages.sendNotifications = this.translate.instant(
        `VO_DETAIL.APPLICATION.TOOLTIPS.SEND_NOTIFICATION.${state}`
      );
    } else {
      const tooltip = this.translate.instant(
        this.selectedApplications.length === 0
          ? 'VO_DETAIL.APPLICATION.TOOLTIPS.NO_APPLICATION_SELECTED'
          : 'VO_DETAIL.APPLICATION.TOOLTIPS.MULTIPLE_STATUSES_SELECTED'
      );
      this.tooltipMessages.approve = tooltip;
      this.tooltipMessages.reject = tooltip;
      this.tooltipMessages.delete = tooltip;
      this.tooltipMessages.sendNotifications = tooltip;
    }
  }
}
