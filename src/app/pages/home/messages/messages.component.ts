import { Injectable, Inject, Component, OnInit } from '@angular/core';
import { MessageConversationService } from '../../../services/message-conversation.service';
import { DataStoreService } from '../../../services/data-store.service';
import { UserService } from '../../../services/user.service';
import { ToastService } from '../../../services/toast.service';
import { SharedDataService } from '../../../shared/shared-data.service';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';
import { MessageConversation } from '../../../models/message-conversation.model';
import { DialogService } from 'ng2-bootstrap-modal';
import { ComposeMessageComponent } from './compose-message/compose-message.component';
import { ComposeFeedbackComponent } from './compose-feedback/compose-feedback.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import async from 'async-es';
import * as moment from 'moment';


@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit {

  public isActive = 'all';
  public filter: string = '';
  public isDataLoaded = false;
  public isLoadingMessagesPagination = false;
  public isUserSupportMsg = false;
  public loadingDataStoreValue = true;
  public messages: any = [];
  public openedMessage: string = null;
  public currentPage: Number;
  public pager: any = {};
  public dataStoreValues: any = [];
  public feedbackRecipients: any = [];
  public assignedMember: string = 'none';
  public messageConversation: Observable<MessageConversation[]>;
  public messageReplyFormGroup: FormGroup;
  public dataStoreKey: string;
  public disableApproveAll: boolean = false;
  public isCurrentUserInFeedbackGroup: boolean = false;
  public statuses = ['OPEN', 'PENDING', 'INVALID', 'SOLVED'];
  public priorities = ['LOW', 'MEDIUM', 'HIGH'];
  public currentUser: any;


  constructor(private _messageConversationService: MessageConversationService,
              private _dialogService: DialogService,
              private _dataStoreService: DataStoreService,
              private _sharedDataService: SharedDataService,
              private _userService: UserService,
              @Inject('rootDir') _rootDir: string,
              private _toastService: ToastService) {
  }

  ngOnInit() {

    this.messageReplyFormGroup = new FormGroup({
      message: new FormControl('',Validators.required),
      status: new FormControl(''),
      priority: new FormControl(''),
      assign: new FormControl(this.assignedMember),
    });

    this.messageReplyFormGroup.controls['status'].valueChanges.subscribe(valueChange => {
      let payload = {
        status: valueChange
      }
      this._messageConversationService.updateStatus(this.openedMessage, payload);

    });

    this.messageReplyFormGroup.controls['priority'].valueChanges.subscribe(valueChange => {
      let payload = {
        priority: valueChange
      }
      this._messageConversationService.setPriority(this.openedMessage, payload);
    });

    this.messageReplyFormGroup.controls['assign'].valueChanges.subscribe(valueChange => {
      if(valueChange == 'none'){
        this._messageConversationService.deleteAssignment(this.openedMessage);
        this.assignedMember = 'none';
      }else{
        this._messageConversationService.assignToMember(this.openedMessage, valueChange);
        this.assignedMember = valueChange.toString();
      }
    });

    async.parallel([
      (callback) => {
        this._sharedDataService.getFeedbackReceipients().subscribe(response => {
          callback(null, response)
        })
      },
      (callback) => {
        this._userService.getUserInformation().subscribe(response => {
          callback(null, response);
        })
      },
      (callback) => {
        this.getAllUserMessageConversations();

        callback(null, null);
      }
    ], (error, results) => {
      console.log(results[1]);
      this.currentUser = results[1];
      this.feedbackRecipients = _.transform(results[0].users,(result, user) =>{
        result.push({id: user.id, name: user.displayName});
      },[]);

      // Add none which will be use to delete assingment
      this.feedbackRecipients.push({id:'none', name: 'None'});
      this.isCurrentUserInFeedbackGroup = _.findIndex(results[1].userGroups, { id: results[0].id }) !== -1;

    })



  }

  messagesFilters(filter) {
    switch (filter) {
      case 'followUp':
        if (this.isActive !== filter) {
          this.isActive = filter;
          this.filter = 'filter=followUp:in:[true]';
          this.getAllUserMessageConversations();
        }
        break;
      case 'assignedToMe':

        if (this.isActive !== filter) {
          this.isActive = filter;
          this.filter = `filter=assignee.id:eq:${this.currentUser.id}`;
          this.getAllUserMessageConversations();
        }
        break;
      default:

        if (this.isActive !== filter) {
          this.isActive = filter;
          this.filter = '';
          this.getAllUserMessageConversations();
        }
        break;
    }
  }

  openMessage(message) {
    this.openedMessage = message.id;
    this.checkIfIsUserSupportMessage(message);
    this.markAsRead(message);
  }

  markAsRead(message) {
    if (!message.read) {
      message.read = true;
      this._messageConversationService.markAsRead(message);
    }
  }

  deleteMessage(message) {
    this._messageConversationService.deleteConversation(message.id);
  }


  closeMessage() {
    this.openedMessage = null;
  }

  getAllUserMessageConversations(pageNumber?: Number) {
    this._messageConversationService.loadAll(pageNumber, this.filter);
    this.messageConversation = this._messageConversationService.messageConversation;
    this._messageConversationService.pager.subscribe(val => {
      this.pager = val;
      this.isDataLoaded = true;
    });
  }

  showComposeMessage(subject?: string, text?: string) {
    let disposable = this._dialogService.addDialog(ComposeMessageComponent, {
      subject: subject,
      text: text
    })
      .subscribe((isConfirmed) => {

      });
  }

  showComposeFeedback(subject?: string, text?: string) {
    let disposable = this._dialogService.addDialog(ComposeFeedbackComponent, {
      subject: subject,
      text: text
    })
      .subscribe((isConfirmed) => {

      });
  }


  getPage(page) {
    this.currentPage = page;
    this.isDataLoaded = false;
    this.isLoadingMessagesPagination = true;
    this.getAllUserMessageConversations(page);
  }


  onReplyMessage(conversationID: String, { value, valid }: { value: any, valid: boolean }) {
    this._messageConversationService.replyConversation(conversationID, value.message);
    this.messageReplyFormGroup.reset();
    this.closeMessage();
  }

  /**
   * [checkIfIsUserSupportMessage: this checks if the message is from user support application]
   * @param  {[object]} message [single object to check if is from user support application]
   * @return {[void]}         [none]
   */
  checkIfIsUserSupportMessage(message) {
    if(message.assignee){
      this.messageReplyFormGroup.controls['assign'].patchValue(message.assignee.id);
    }

    let formatter = new Intl.DateTimeFormat("fr", { month: "short" }),
      month_reg = formatter.format(new Date()).slice(0, -1),
      regex1 = new RegExp('^' + month_reg, 'i'),
      regex2 = message.subject.includes(':'),
      dataStoreKey = message.subject.split(':')[0];

    if (regex1.test(dataStoreKey) && regex2 && dataStoreKey.includes('_')) {
      this.dataStoreKey = dataStoreKey;
      this.loadAndFormatDataStoreValue(dataStoreKey);
      this.isUserSupportMsg = true;
    } else {
      this.isUserSupportMsg = false;
    }

  }

  /**
   * [loadAndFormatDataStoreValue description]
   * @param  {string} dataStoreKey [description]
   * @return {[type]}              [description]
   */

  loadAndFormatDataStoreValue(dataStoreKey: string) {
    this._dataStoreService.getValuesOfDataStoreNamespaceKeys(dataStoreKey)
      .subscribe(response => {
        this.loadingDataStoreValue = false;
        this.dataStoreValues = response;
        this.disableApproveAll = (_.findIndex(response, { status: 'SOLVED' }) !== -1);
      });
  }

  approveChangesDataset(dataSet: any) {
    let asyncRequestsArray = [];
    let updatedDatastoreValues = [];

    if (_.isArray(dataSet)) {
      asyncRequestsArray = _.transform(dataSet, (result, obj) => {
        obj.status = 'SOLVED';
        result.push(obj);
      }, []);
      updatedDatastoreValues = asyncRequestsArray;
      this.disableApproveAll = true;

    } else {
      let index = _.findIndex(this.dataStoreValues, { url: dataSet.url });
      dataSet.status = 'SOLVED';
      this.dataStoreValues.splice(index, 1, dataSet);

      updatedDatastoreValues = this.dataStoreValues;
      asyncRequestsArray.push(dataSet);
    }

    /**
     * [map map all object]
     * @param  {[object]} asyncRequestsArray   [dataset array to be posted]
     * @param  {[function]} this.requestCallBack [callback function]
     * @param  {[function]} this.asyncDone       [callback function]
     */
    async.map(asyncRequestsArray, this.requestCallBack, this.asyncDone);

    this._dataStoreService.updateValuesDataStore(this.dataStoreKey, updatedDatastoreValues)
      .subscribe(response => {

        if(response.ok){
          this._toastService.success('Datastore status was updated successfully.');

        } else {
          this._toastService.error('There was an error when updating Datastore Status.');

        }
      });

  }

  /**
   * [callback: This function will be executed for every object in array async and parallel]
   * @param  {[object]} obj          [object in a collection]
   * @param  {[function]} doneCallBack [A call back function]
   * @return {[function]}              [callback function with error and response results]
   */
  callback(obj, doneCallBack) {
    if (obj.method.toLowerCase() === 'put') {

      this._sharedDataService.genericPutRequest(obj.url, obj.payload).subscribe(response => {
        return doneCallBack(null, response);
      });
    } else if(obj.method.toLowerCase() === 'post') {
      this._sharedDataService.genericPostRequest(obj.url, obj.payload).subscribe(response => {
        return doneCallBack(null, response);
      });
    }

  }

  /**
   * [this is to bind this in the callback]
   * @param  {[object]} this [global object that holds the value of this function]
   * @return {[function]}      [callback function with global this variable]
   */
  requestCallBack = this.callback.bind(this);

  /**
   * [asyncDone: This is the final done callback after async execution of all request]
   * @param  {[object]} error   [Array collection of all errors]
   * @param  {[object]} results [Array collection of all response results]
   * @return {[void]}         [none]
   */
  private asyncDone(error, results) {
    console.log(results);
    if(results.length){
      this._toastService.success('Approved changes were updated successfully.');

    } else {
      this._toastService.error('There was an error when sending approved changes.');

    }
  }

  /**
   * [formatDate: format date to well understandable way]
   * @param  {[date]} date [creted date in ISO]
   * @return {[date]}      [formated date to human readable]
   */
  formatDate(date) {
    return moment(date).format('ll')
  }

}
