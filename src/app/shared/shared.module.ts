import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';


//services
import { SharedDataService } from './shared-data.service';
import { LimitToPipe } from './limit-to.pipe';
import { FilterLevelPipe } from './filter-level.pipe';
import { FilterByKeyValuesPipe } from './filter-by-key-values.pipe';
import { ClickOutsideDirective } from './click-outside.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  providers: [
    SharedDataService
  ],
  declarations: [LimitToPipe, FilterLevelPipe, FilterByKeyValuesPipe, ClickOutsideDirective],
  exports: [LimitToPipe, FilterLevelPipe, FilterByKeyValuesPipe, ClickOutsideDirective]
})
export class SharedModule { }
